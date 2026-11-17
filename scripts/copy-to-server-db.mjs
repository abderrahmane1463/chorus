/**
 * Copies the whole Chorus database from Neon into another PostgreSQL, such
 * as one on the same server as the app.
 *
 *   SOURCE_DATABASE_URL  where to read from (defaults to DATABASE_URL)
 *   TARGET_DATABASE_URL  where to write to: never a Neon address
 *
 *   node scripts/copy-to-server-db.mjs            target must be empty
 *   node scripts/copy-to-server-db.mjs --replace  wipes Chorus's tables in
 *                                                 the target, then copies
 *
 * The source is only read. The target's tables are built from the migration
 * files, without database-side UUID defaults (the app generates ids, and
 * PostgreSQL before 13 has no gen_random_uuid). Rows are copied first and
 * foreign keys and indexes added after, so table order and the
 * events <-> interactions cycle do not matter. Each table's row count is
 * checked at the end; any difference fails the run.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const replace = process.argv.includes('--replace');

// Panels that run npm commands (Plesk) may not pass the app's environment
// variables, which Next reads from .env files. Read the same files; a
// variable already set wins over any file.
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  const path = join(root, file);
  if (existsSync(path)) {
    process.loadEnvFile(path);
    console.log(`Read ${file}`);
  }
}
for (const name of ['SOURCE_DATABASE_URL', 'DATABASE_URL', 'TARGET_DATABASE_URL']) {
  console.log(`  ${name}: ${process.env[name] ? 'set' : 'not set'}`);
}

const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

if (!sourceUrl) fail('No source: set SOURCE_DATABASE_URL (or DATABASE_URL).');
if (!targetUrl) fail('No target: set TARGET_DATABASE_URL.');
if (!hostOf(sourceUrl).endsWith('.neon.tech')) {
  fail('The source is not a Neon address. Nothing to copy from.');
}
if (hostOf(targetUrl).endsWith('.neon.tech')) {
  fail('The target is a Neon address. This script only writes to another server.');
}

const source = neon(sourceUrl);
const target = new pg.Client({ connectionString: targetUrl });

/** Reads from Neon, retrying network failures: the route there can drop. */
async function read(text, params = []) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await source.query(text, params);
    } catch (error) {
      if (attempt >= 5 || !(error instanceof TypeError)) throw error;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

/** The migrations, in order, split into statements. */
function migrationStatements() {
  const dir = join(root, 'db', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('--> statement-breakpoint'))
    .map((s) => s.trim().replace(/\s+DEFAULT gen_random_uuid\(\)/g, ''))
    .filter(Boolean);
}

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

async function main() {
  await target.connect();
  const { rows: version } = await target.query('show server_version');
  console.log(`Target PostgreSQL ${version[0].server_version}`);

  const sourceTables = (
    await read(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
    )
  ).map((r) => r.table_name);
  console.log(`Source tables: ${sourceTables.length}`);

  const { rows: existing } = await target.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const ours = existing.map((r) => r.table_name).filter((t) => sourceTables.includes(t));
  if (ours.length > 0) {
    if (!replace) {
      fail(
        `The target already has Chorus tables (${ours.join(', ')}).\n` +
          '  Run again with --replace to wipe them and copy fresh.',
      );
    }
    console.log('Wiping the target\'s Chorus tables…');
    await target.query(`drop table if exists ${sourceTables.map(quote).join(', ')} cascade`);
    const { rows: types } = await target.query(
      `select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'`,
    );
    for (const { typname } of types) await target.query(`drop type if exists ${quote(typname)} cascade`);
  }

  // Tables and types first; keys and indexes once the rows are in.
  const statements = migrationStatements();
  const isKey = (s) => /FOREIGN KEY/i.test(s);
  const isIndex = (s) => /^CREATE (UNIQUE )?INDEX/i.test(s);
  console.log('Creating tables…');
  for (const s of statements.filter((s) => !isKey(s) && !isIndex(s))) await target.query(s);

  // Same columns on both sides, or the copy would silently drop data.
  for (const table of sourceTables) {
    const columns = `select column_name from information_schema.columns
                      where table_schema = 'public' and table_name = $1 order by 1`;
    const a = (await read(columns, [table])).map((r) => r.column_name).join(',');
    const b = (await target.query(columns, [table])).rows.map((r) => r.column_name).join(',');
    if (a !== b) fail(`Columns differ for ${table}:\n  source ${a}\n  target ${b}`);
  }

  console.log('Copying rows…');
  const counts = [];
  for (const table of sourceTables) {
    const [{ n }] = await read(`select count(*)::int as n from ${quote(table)}`);
    // Uploaded images are large rows: fewer per round trip.
    const batch = table === 'event_assets' ? 10 : 500;
    for (let offset = 0; offset < n; offset += batch) {
      const [{ rows }] = await read(
        `select coalesce(json_agg(t), '[]'::json) as rows
           from (select * from ${quote(table)} order by 1, 2 limit ${batch} offset ${offset}) t`,
      );
      await target.query(
        `insert into ${quote(table)}
         select * from json_populate_recordset(null::${quote(table)}, $1::json)`,
        [JSON.stringify(rows)],
      );
    }
    counts.push([table, n]);
    process.stdout.write(`  ${table}: ${n}\n`);
  }

  console.log('Adding keys and indexes…');
  for (const s of statements.filter((s) => isKey(s) || isIndex(s))) await target.query(s);

  console.log('Checking…');
  let ok = true;
  for (const [table, n] of counts) {
    const { rows } = await target.query(`select count(*)::int as n from ${quote(table)}`);
    if (rows[0].n !== n) {
      ok = false;
      console.error(`  ✗ ${table}: source ${n}, target ${rows[0].n}`);
    }
  }
  if (!ok) fail('Row counts differ. Do not switch to the new database.');

  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  console.log(`\n✓ Done: ${counts.length} tables, ${total} rows, every count matches.\n`);
}

main()
  .catch((error) => fail(error.message || String(error)))
  .finally(() => target.end().catch(() => {}));
