import type { events } from '@/db/schema';

type EventStatus = (typeof events.status.enumValues)[number];

/**
 * Whether an event still takes part from its audience: answers, questions,
 * votes and new players.
 *
 * Ended and archived events do not; that is what those states are for. A
 * draft does, so a host can run an event without first setting it live.
 */
export function acceptsAudience(status: EventStatus): boolean {
  return status !== 'ended' && status !== 'archived';
}
