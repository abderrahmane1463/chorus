/**
 * Lists the latest activity in the database: who joined, what was asked or
 * answered. Read-only.
 *
 *   node scripts/recent-activity.mjs        the last 24 hours
 *   node scripts/recent-activity.mjs 72     the last 72 hours
 *
 * Uses TARGET_DATABASE_URL or DATABASE_URL, from the environment or from the
 * app's .env files (Plesk's command screen passes no variables).
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}

const hours = Math.max(1, Number(process.argv[2]) || 24);
const url = [process.env.TARGET_DATABASE_URL, process.env.DATABASE_URL].find(
  (u) => u && !u.includes('.neon.tech'),
);
if (!url) {
  console.error('✗ No server database address found (TARGET_DATABASE_URL in .env).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
const since = `now() - interval '${hours} hours'`;
const short = (s, n = 90) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');
const time = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

try {
  await client.connect();
  console.log(`Server database, last ${hours} h\n`);

  const { rows: joined } = await client.query(
    `select e.event_code, e.title, count(*)::int n, max(p.joined_at) last
       from participants p join events e on e.id = p.event_id
      where p.joined_at > ${since} group by 1, 2 order by last desc`,
  );
  console.log('Participants who joined:');
  if (!joined.length) console.log('  none');
  for (const r of joined) console.log(`  ${r.event_code}  ${short(r.title, 40)}: ${r.n} (last ${time(r.last)})`);

  const { rows: questions } = await client.query(
    `select e.event_code, q.text, q.status, q.created_at
       from questions q join events e on e.id = q.event_id
      where q.created_at > ${since} order by q.created_at desc limit 30`,
  );
  console.log('\nQuestions:');
  if (!questions.length) console.log('  none');
  for (const r of questions) console.log(`  ${time(r.created_at)}  ${r.event_code}  [${r.status}]  ${short(r.text)}`);

  const { rows: answers } = await client.query(
    `select e.event_code, i.title, i.type, r.response_data, r.created_at
       from responses r join interactions i on i.id = r.interaction_id
       join events e on e.id = i.event_id
      where r.created_at > ${since} order by r.created_at desc limit 30`,
  );
  console.log('\nAnswers:');
  if (!answers.length) console.log('  none');
  for (const r of answers) {
    const d = r.response_data ?? {};
    const value = d.text ?? d.value ?? d.words ?? d.optionIds ?? d.ranking ?? d;
    console.log(`  ${time(r.created_at)}  ${r.event_code}  ${short(r.title, 40)} (${r.type}): ${short(JSON.stringify(value), 80)}`);
  }

  const { rows: totals } = await client.query(
    `select (select count(*) from events)::int events, (select count(*) from participants)::int participants,
            (select count(*) from questions)::int questions, (select count(*) from responses)::int responses`,
  );
  const t = totals[0];
  console.log(`\nTotals: ${t.events} events, ${t.participants} participants, ${t.questions} questions, ${t.responses} answers`);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
