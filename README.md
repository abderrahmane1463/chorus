# Chorus

Live polls, audience Q&A and quizzes for meetings, classes and conferences.
Hosts sign in and run a room; participants join with a short code from any
browser, with no account and no install.

---

## 1. Project structure

```
app/
  (marketing)/            Landing page + marketing layout
  (auth)/                 Sign in / sign up
  dashboard/
    events/
      [eventId]/          Event workspace (interaction list + editor)
        analytics/        Per-event analytics + CSV export links
        settings/         Join details, rename, danger zone
      new/                Create event
    analytics/            Cross-event overview
  present/[eventId]/      Presenter mode (projector surface)
  event/[eventCode]/      Participant surface
  join/                   Join by code
  api/
    auth/[...nextauth]/   Auth.js handlers
    realtime/             Server-Sent Events stream (SSE driver)
    events/[eventId]/export/  CSV export
components/
  ui/                     Design-system primitives (Radix + cva)
  marketing/ dashboard/ participant/ present/ interactions/ analytics/ shared/
lib/
  db/                     Drizzle client (Neon HTTP + retry)
  auth/                   Auth.js config, password hashing, requireUser
  realtime/               Channels, event names, publisher, client, in-process bus
  queries/                Read models (server-only)
  actions/                Server Actions (all writes)
  interactions/           Type registry, defaults, normalisation
  quiz/                   Scoring
  validations/            Zod schemas
  utils/                  cn, event codes, formatting, CSV
db/
  schema/                 Drizzle table definitions
  migrations/             Generated SQL
  seed.ts                 Demo data
hooks/                    useRealtime, useEventSync
types/                    Shared types
proxy.ts                  Route protection (Next 16's middleware convention)
```

UI, business logic, database queries, validation and realtime are separate
modules; pages compose them and hold no logic of their own.

---

## 2. Database schema

14 tables. Ownership always runs through `events.owner_id`.

| Table | Purpose |
| --- | --- |
| `users`, `accounts`, `sessions`, `verification_tokens` | Auth.js. `password_hash` is nullable so OAuth can be added without a migration |
| `events` | Title, description, unique `event_code`, status, `active_interaction_id` |
| `event_members` | Collaborators with a role, unique per (event, user) |
| `interactions` | Every interaction. `parent_id` makes quizzes and surveys containers whose questions are child rows |
| `interaction_options` | Choices, with `is_correct` for quiz questions |
| `participants` | Anonymous audience members, unique per (event, session) |
| `responses` | Answers as JSONB, unique per (interaction, participant, **slot**) |
| `questions`, `question_votes` | Q&A, one vote per person per question |
| `quiz_scores` | Running score, unique per (quiz, participant) |
| `analytics_events` | Append-only activity log |

**`responses.slot` is the duplicate-prevention mechanism.** Single-answer
interactions always write slot 0, so the unique constraint rejects a second
row at the database level rather than relying on an application check.
Word clouds increment the slot to allow a configured number of entries.

Enums: `event_status`, `member_role`, `interaction_type`, `interaction_status`,
`question_status`. Foreign keys cascade from events downward.

---

## 3. Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon pooled connection |
| `DATABASE_URL_UNPOOLED` | yes | Direct connection for migrations |
| `AUTH_SECRET` | yes | Signs session JWTs (`npx auth secret`) |
| `AUTH_URL` | yes | Public origin Auth.js redirects to |
| `AUTH_TRUST_HOST` | behind a proxy | Let Auth.js trust the request host |
| `NEXT_PUBLIC_APP_URL` | yes | Builds join links and the presenter QR code |
| `PARTICIPANT_COOKIE_SECRET` | yes | HMAC for the anonymous participant cookie |
| `SERVER_ACTION_ALLOWED_ORIGINS` | behind a proxy | Extra origins allowed to submit forms |
| `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | for Vercel | Switches realtime to Pusher |

`SERVER_ACTION_ALLOWED_ORIGINS` matters: Next silently rejects Server Actions
from an origin it does not recognise, which makes every form appear to do
nothing. Set it whenever the public origin differs from `localhost`.

---

## 4. Run locally

```bash
npm install
npm run dev
```

---

## 5. Migrate the database

```bash
npm run db:generate   # generate SQL from the Drizzle schema
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse the data
```

---

## 6. Seed the database

```bash
npm run db:seed
```

Creates host `demo@chorus.test` / `chorus1234` and the event **Digital
Marketing Workshop**, code **MARKETING26**, with a multiple-choice poll, a word
cloud, a 1–10 rating, a Q&A and a three-question quiz. Re-running replaces the
demo event rather than duplicating it.

---

## 7. Deploy to Vercel

1. Push to GitHub and import the repository into Vercel.
2. Set every variable from section 3, including the four Pusher ones.
3. Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the deployed origin.
4. Run `npm run db:migrate` against the production branch.

**Pusher is required on Vercel.** The built-in SSE driver only reaches clients
connected to the same Node process, and Vercel runs many.

---

## 8. How realtime works

A driver abstraction with two implementations, chosen by whether the Pusher
variables are set:

- **SSE** (default) — an in-process bus fans out to `/api/realtime`. Genuine
  server push, no external account, correct for local dev and single-node hosts.
- **Pusher** — same publish call, fans out across instances.

Messages carry only *what changed* — an event name and an id — never the new
data. Receiving one triggers a refetch from the server. A dropped, duplicated
or out-of-order message therefore cannot leave a client showing numbers the
database does not agree with. Bursts collapse into one refetch via a 220ms
debounce, and both host and participant headers show the live connection state.

Write flow: participant submits → Zod validates shape → the server re-resolves
who they are, whether the interaction is open, and what a valid answer looks
like → database write (constraints enforce uniqueness) → publish → clients
refetch.

---

## 9. Implemented features

**Hosts** — email/password auth, event CRUD, human-friendly join codes
(`BRAVO-42`, ambiguous characters excluded), an interaction workspace, presenter
mode with QR code and fullscreen, per-event analytics with charts, CSV export.

**Eight interaction types** — multiple choice, word cloud, rating, open text,
ranking (drag or arrows), Q&A (upvotes, anonymity, moderation), quiz (timer,
speed-bonus scoring, leaderboard), survey (multi-question, completion tracking).

**Participants** — join by code with no account, mobile-first surfaces for every
type, live results when the host allows them, signed anonymous sessions.

**Security** — Zod on every input; ownership enforced inside `WHERE` clauses,
not checked afterwards; participant identity is an HMAC-signed httpOnly cookie;
quiz correct answers withheld from the payload until reveal; anonymous authors
blanked server-side; CSV fields guarded against spreadsheet formula injection;
duplicate votes prevented by database constraints.

---

## 10. Future improvements

- Google OAuth (the adapter is already wired; add the provider)
- Rate limiting on participant actions (currently constraint-bound, not throttled)
- Collaborators UI — `event_members` exists but has no screen yet
- Excel and PDF export alongside CSV
- Word cloud with a real spiral layout rather than inline scaling
- Reordering interactions by drag (the action exists, no UI)
- Populate `analytics_events` and build funnel views on it
- Automated test suite (Playwright for the host↔participant flows)
