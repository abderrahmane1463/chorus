'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, participants } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { removeParticipantSchema } from '@/lib/validations/user';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { ActionResult } from './auth';

/**
 * Takes a player out of an event: a rude nickname, or someone who should not
 * be in the room.
 *
 * Their answers and score go with them, so the scoreboard does not keep a
 * name the host removed. Ownership is part of the delete itself, so a host
 * can only ever remove players from their own events.
 *
 * Removing does not bar the person: the join code is still on the screen.
 * It clears the name from the room, which is what a host needs mid-event;
 * the phone learns it was removed and goes back to the join screen.
 */
export async function removeParticipantAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();
  const user = await requireUser();

  const parsed = removeParticipantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.participantNotFound') };

  const removed = await db
    .delete(participants)
    .where(
      and(
        eq(participants.id, parsed.data.participantId),
        inArray(
          participants.eventId,
          db.select({ id: events.id }).from(events).where(eq(events.ownerId, user.id)),
        ),
      ),
    )
    .returning({ eventId: participants.eventId });

  if (removed.length === 0) return { ok: false, error: t('errors.participantNotFound') };

  const { eventId } = removed[0];

  // Every screen refetches: the host's lists drop the name, and the removed
  // player's own page finds it no longer has a seat and leaves.
  await publish(channels.event(eventId), RealtimeEvent.ParticipantRemoved, { eventId });

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
