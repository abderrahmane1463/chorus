import 'server-only';

/**
 * What every phone in a room reads alike, read once.
 *
 * At a reveal every phone in the room reloads its page in the same second,
 * and most of what each one reads is the same for all of them: the quiz,
 * the question, the scoreboard. Read separately, a room of 300 made
 * thousands of database round trips at once, and the reveal reached the
 * last phones many seconds late. Here the first phone to ask reads it and
 * the others share that read, including while it is still in flight.
 *
 * A room's reads are kept against its version, and the version moves on
 * every realtime message published for the event (see `publish`). Since a
 * message is only published after its write commits, and phones only reload
 * because of a message, a phone never reads a room older than the change it
 * was told about. A short lifetime covers the few writes that publish
 * nothing, such as who is still in the room.
 *
 * This lives in the server's memory, so it assumes one server process, as
 * the in-process realtime bus already does.
 */

type Entry = { expires: number; value: Promise<unknown> };

type RoomState = {
  versions: Map<string, number>;
  /** Moves only when a player is removed: who is who changes far less often. */
  rosters: Map<string, number>;
  entries: Map<string, Entry>;
  /** Which event a join code belongs to, so a code's reads follow its room. */
  codes: Map<string, string>;
};

const LIFETIME_MS = 5_000;
/** Who a phone's session belongs to changes only on removal, so it lives longer. */
export const IDENTITY_LIFETIME_MS = 60_000;
const SWEEP_ABOVE = 2_000;

// Kept on globalThis so every part of the server shares one copy, as the
// realtime bus does.
const globalRef = globalThis as unknown as { __roomCache?: RoomState };
const state: RoomState = globalRef.__roomCache ?? {
  versions: new Map(),
  rosters: new Map(),
  entries: new Map(),
  codes: new Map(),
};
globalRef.__roomCache = state;

/** Marks the room as changed, so the next read of it reads the database. */
export function roomChanged(eventId: string, { removal = false } = {}) {
  state.versions.set(eventId, (state.versions.get(eventId) ?? 0) + 1);
  if (removal) state.rosters.set(eventId, (state.rosters.get(eventId) ?? 0) + 1);
}

/** The room as it is now: reads made under it hold until it next changes. */
export function roomVersion(eventId: string) {
  return state.versions.get(eventId) ?? 0;
}

/** The room's players as they are now: moves only when one is removed. */
export function rosterVersion(eventId: string) {
  return state.rosters.get(eventId) ?? 0;
}

/** The event a join code was last found to belong to, if any. */
export function knownEventFor(code: string) {
  return state.codes.get(code);
}

export function rememberEventCode(code: string, eventId: string) {
  state.codes.set(code, eventId);
}

/**
 * Reads `key` once for everyone asking within its lifetime. The key must say
 * which version of the room it was read under.
 *
 * With `keep`, a result it rejects is shared with whoever asked meanwhile but
 * not remembered past that: "not joined yet" must not outlive the join.
 */
export function shared<T>(
  key: string,
  load: () => Promise<T>,
  { lifetimeMs = LIFETIME_MS, keep }: { lifetimeMs?: number; keep?: (value: T) => boolean } = {},
): Promise<T> {
  const now = Date.now();
  const hit = state.entries.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;

  const value = load();
  state.entries.set(key, { expires: now + lifetimeMs, value });
  // A failed read is not remembered: the next phone tries again.
  const forget = () => {
    if (state.entries.get(key)?.value === value) state.entries.delete(key);
  };
  value.then((result) => {
    if (keep && !keep(result)) forget();
  }, forget);

  if (state.entries.size > SWEEP_ABOVE) {
    for (const [stale, entry] of state.entries) {
      if (entry.expires <= now) state.entries.delete(stale);
    }
  }

  return value;
}
