import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bus } from '@/lib/realtime/bus';

/**
 * Keeps the database awake while anyone is watching a live page.
 *
 * The database sleeps after a few idle minutes and takes seconds to wake,
 * and whoever taps first after a quiet spell waits for it: a host opening
 * the next question, a participant's first answer. While a phone, the big
 * screen or the dashboard has a live connection open, a tiny query every few
 * minutes keeps it from falling asleep. With nobody connected it is left to
 * sleep, so it costs nothing between events.
 */
const EVERY_MS = 4 * 60_000;

const globalRef = globalThis as unknown as { __keepWarm?: ReturnType<typeof setInterval> };

export function keepDatabaseWarm() {
  if (globalRef.__keepWarm) return;
  globalRef.__keepWarm = setInterval(() => {
    if (!bus.hasSubscribers()) return;
    db.execute(sql`select 1`).catch(() => {
      // A missed ping only means the next one, or the next real query, wakes it.
    });
  }, EVERY_MS);
  // Never the reason the process stays alive.
  globalRef.__keepWarm.unref?.();
}
