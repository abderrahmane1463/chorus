import 'server-only';
import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { participants } from '@/db/schema';
import { PRESENCE_WINDOW_SECONDS } from '@/lib/participant/presence';

/**
 * True for a participant heard from within the presence window.
 *
 * Stamped and compared on the database's clock, both sides of it. The app
 * servers' clocks are not the database's, and a comparison that mixed them
 * would put a player in or out of the room by however far they disagree.
 */
export const isPresent = sql`${participants.lastSeenAt} > now() - ${sql.raw(
  // A constant of ours, never input, so it can be written into the query.
  `interval '${PRESENCE_WINDOW_SECONDS} seconds'`,
)}`;

/** The value to stamp `last_seen_at` with: the database's own clock. */
export const seenNow = sql`now()`;

/** How many players are in the room right now. */
export async function countPresentPlayers(eventId: string): Promise<number> {
  const [{ present }] = await db
    .select({ present: count() })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), isPresent));

  return present;
}
