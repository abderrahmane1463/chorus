/**
 * Simulates a room of players answering one quiz question.
 *
 *   npm run build
 *   npm run start -- -p 3100
 *   node --env-file=.env.local scripts/load-test.mjs --players 100 --owner you@example.com
 *
 * Each simulated player does what a phone does: loads the event page, holds a
 * realtime connection, refetches the page when told something changed, and
 * answers the question at a random moment. The run reports how long answers
 * and refetches took, which is what a player would feel.
 *
 * It creates a temporary event in the database the server is using and
 * deletes it afterwards. It must run on the machine that built the app: the
 * id of the answer action is read from the build output.
 *
 * Options:
 *   --players N     how many players                      (default 50)
 *   --spread S      seconds over which they answer        (default 10)
 *   --url URL       the server under test                 (default http://localhost:3100)
 *   --owner EMAIL   the account the temporary event is created under
 *   --channels a,b  realtime channel suffixes a phone listens on, as
 *                   a comma-separated list of "", "qa", ...   (default ",qa")
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);

const PLAYERS = Number(args.players ?? 50);
const SPREAD_MS = Number(args.spread ?? 10) * 1000;
const BASE = (args.url ?? 'http://localhost:3100').replace(/\/$/, '');
const OWNER = args.owner;
const SUFFIXES = (args.channels ?? ',qa').split(',');

const CODE = 'LOADTEST';
const WARMUP_MS = 4000;
const ARRIVAL_MS = 5000;
// Long enough for every phone's refetch after the reveal to finish and be counted.
const SETTLE_MS = 15000;

// Mirrors hooks/use-event-sync.ts. A simulated phone that refetched more
// eagerly than the real one would measure a load the app never generates.
const REFRESH_DEBOUNCE_MS = 220;
const MIN_REFRESH_INTERVAL_MS = 1000;
// Mirrors what app/event/[eventCode]/page.tsx passes as `ignore` for a quiz.
const IGNORED = new Set(['PARTICIPANT_JOINED', 'RESPONSE_CREATED', 'RESPONSE_UPDATED']);

if (!OWNER) throw new Error('pass --owner <email of an existing account>');
if (!process.env.DATABASE_URL || !process.env.PARTICIPANT_COOKIE_SECRET) {
  throw new Error('run with --env-file=.env.local');
}

const sql = neon(process.env.DATABASE_URL);

const cookieFor = (sessionId) =>
  `chorus_participant=${sessionId}.${createHmac('sha256', process.env.PARTICIPANT_COOKIE_SECRET)
    .update(sessionId)
    .digest('base64url')}`;

function actionId(name) {
  const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8'));
  const found = Object.entries(manifest.node).find(([, action]) => action.exportedName === name);
  if (!found) throw new Error(`no ${name} in the build; run npm run build first`);
  return found[0];
}

async function setup() {
  const [user] = await sql`select id from users where email = ${OWNER}`;
  if (!user) throw new Error('no account with that email');

  await sql`delete from events where event_code = ${CODE}`;
  const [event] = await sql`insert into events (owner_id, title, event_code, status)
    values (${user.id}, 'Load test (temporary)', ${CODE}, 'live') returning id`;
  const [quiz] = await sql`insert into interactions (event_id, type, title, position, status, settings, started_at)
    values (${event.id}, 'quiz', 'Load test quiz', 0, 'active', '{}', ${new Date().toISOString()}) returning id`;
  await sql`update events set active_interaction_id = ${quiz.id} where id = ${event.id}`;

  const settings = JSON.stringify({ timeLimitSeconds: 120, points: 1000, speedBonus: true });
  const [question] = await sql`insert into interactions (event_id, parent_id, type, title, position, status, settings, started_at)
    values (${event.id}, ${quiz.id}, 'multiple_choice', 'Which answer is right?', 0, 'draft', ${settings}::jsonb,
      ${new Date(Date.now() + 1000).toISOString()}) returning id`;
  const options = [];
  for (const [position, text] of ['One', 'Two', 'Three', 'Four'].entries()) {
    const [option] = await sql`insert into interaction_options (interaction_id, text, position, is_correct)
      values (${question.id}, ${text}, ${position}, ${position === 0}) returning id`;
    options.push(option.id);
  }
  await sql`update interactions set current_child_id = ${question.id} where id = ${quiz.id}`;

  // One statement for the whole room. Seen "now" on the database's clock, as
  // the app stamps it, so every player counts as present for the run.
  const names = Array.from({ length: PLAYERS }, (_, i) => `Player ${i + 1}`);
  const sessions = names.map((_, i) => `load-${i}`);
  await sql`insert into participants (event_id, session_id, display_name, last_seen_at)
    select ${event.id}, s, n, now()
    from unnest(${sessions}::text[], ${names}::text[]) as t(s, n)`;

  return { eventId: event.id, questionId: question.id, options, sessions };
}

const stats = {
  page: [],
  refresh: [],
  answer: [],
  presence: [],
  errors: 0,
  messages: 0,
  ignored: 0,
  requests: 0,
  /** Why requests failed, counted by reason, so a run says what broke. */
  reasons: new Map(),
};

function blame(reason) {
  stats.errors += 1;
  stats.reasons.set(reason, (stats.reasons.get(reason) ?? 0) + 1);
}

async function timed(bucket, run) {
  const started = performance.now();
  stats.requests += 1;
  try {
    const result = await run();
    if (result !== true) blame(typeof result === 'string' ? result : 'not ok');
  } catch (error) {
    blame(error?.cause?.code ?? error?.code ?? error?.name ?? 'threw');
  }
  stats[bucket].push(performance.now() - started);
}

function player(sessionId, room, answerAction, stop) {
  const cookie = cookieFor(sessionId);
  const page = `${BASE}/event/${CODE}`;
  let timer;
  let lastRefresh = 0;

  const refresh = () => {
    lastRefresh = Date.now();
    return timed('refresh', async () => {
      // What router.refresh() asks for: the page as a component payload.
      const response = await fetch(page, { headers: { cookie, RSC: '1' } });
      await response.text();
      return response.ok || `refetch ${response.status}`;
    });
  };

  const scheduleRefresh = () => {
    clearTimeout(timer);
    const wait = Math.max(REFRESH_DEBOUNCE_MS, MIN_REFRESH_INTERVAL_MS - (Date.now() - lastRefresh));
    timer = setTimeout(refresh, wait);
  };

  const listen = async () => {
    const channels = SUFFIXES.map((suffix) => `event-${room.eventId}${suffix ? `-${suffix}` : ''}`);
    const response = await fetch(
      `${BASE}/api/realtime?channels=${encodeURIComponent(channels.join(','))}`,
      { headers: { cookie }, signal: stop.signal },
    );
    // The page refetches once when its connection opens, as the app does.
    scheduleRefresh();

    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        if (!part.startsWith('data:')) continue;
        stats.messages += 1;
        let name;
        try {
          name = JSON.parse(part.slice(part.indexOf('{'))).event;
        } catch {
          continue;
        }
        if (IGNORED.has(name)) stats.ignored += 1;
        else scheduleRefresh();
      }
    }
  };

  const answer = () =>
    timed('answer', async () => {
      const pick = room.options[Math.floor(Math.random() * room.options.length)];
      const response = await fetch(page, {
        method: 'POST',
        headers: {
          cookie,
          'next-action': answerAction,
          accept: 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          origin: BASE,
        },
        body: JSON.stringify([{ questionId: room.questionId, optionIds: [pick] }]),
      });
      const body = await response.text();
      if (!response.ok) return `answer ${response.status}`;
      return body.includes('"ok":true') || 'answer refused';
    });

  // Mirrors hooks/use-presence.ts: once on arrival, then every half minute.
  let heartbeat;
  const beat = () =>
    timed('presence', async () => {
      const response = await fetch(`${BASE}/api/events/${room.eventId}/presence`, {
        method: 'POST',
        headers: { cookie },
      });
      return response.status === 204 || `presence ${response.status}`;
    });

  return {
    async open() {
      await timed('page', async () => {
        const response = await fetch(page, { headers: { cookie } });
        await response.text();
        return response.ok || `page ${response.status}`;
      });
      listen().catch(() => undefined);
      beat();
      heartbeat = setInterval(beat, 30_000);
    },
    answer,
    close: () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
    },
  };
}

function summary(label, values) {
  if (values.length === 0) return `${label.padEnd(16)} none`;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]);
  return `${label.padEnd(16)} n=${String(values.length).padStart(5)}  p50=${at(0.5)}ms  p95=${at(0.95)}ms  max=${Math.round(sorted.at(-1))}ms`;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const room = await setup();
const answerAction = actionId('submitQuizAnswerAction');
const stop = new AbortController();
const players = room.sessions.map((session) => player(session, room, answerAction, stop));

console.log(`${PLAYERS} players against ${BASE}, answering over ${SPREAD_MS / 1000}s`);

const started = performance.now();
// A real room arrives over a few seconds, not in one instant. Opening every
// connection at once made the test machine refuse them, which measured the
// machine running the test rather than the app.
await Promise.all(
  players.map(async (p, i) => {
    await wait((i / PLAYERS) * ARRIVAL_MS);
    await p.open();
  }),
);
await wait(WARMUP_MS);

const answering = performance.now();
await Promise.all(
  players.map(async (p) => {
    await wait(Math.random() * SPREAD_MS);
    await p.answer();
  }),
);
const answered = performance.now();
await wait(SETTLE_MS);

stop.abort();
players.forEach((p) => p.close());

const [{ stored }] = await sql`select count(*)::int as stored from responses where interaction_id = ${room.questionId}`;
const [{ revealed }] = await sql`select answer_revealed as revealed from interactions where id =
  (select parent_id from interactions where id = ${room.questionId})`;
await sql`delete from events where event_code = ${CODE}`;

console.log(summary('first page', stats.page));
console.log(summary('answer', stats.answer));
console.log(summary('refetch', stats.refresh));
console.log(summary('heartbeat', stats.presence));
const reasons = [...stats.reasons].map(([reason, n]) => `${reason}×${n}`).join(', ');
console.log(
  `answers stored ${stored}/${PLAYERS} · revealed ${revealed} · ` +
    `realtime messages ${stats.messages} (${stats.ignored} needed no refetch) · ` +
    `requests ${stats.requests} · errors ${stats.errors}${reasons ? ` (${reasons})` : ''}`,
);
console.log(
  `answering took ${((answered - answering) / 1000).toFixed(1)}s · whole run ${((performance.now() - started) / 1000).toFixed(1)}s`,
);
process.exit(0);
