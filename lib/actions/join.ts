'use server';

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, participants } from '@/db/schema';
import { ensureSessionId } from '@/lib/participant/session';
import { normalizeEventCode } from '@/lib/utils/event-code';
import { joinEventSchema } from '@/lib/validations/user';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { ActionResult } from './auth';

/**
 * Joins an audience member to an event.
 *
 * Redirects on success, so a returned result always means failure. The
 * participant row is keyed on (event, session) with a unique constraint, which
 * makes rejoining idempotent rather than creating duplicates.
 */
export async function joinEventAction(input: unknown): Promise<ActionResult> {
  const parsed = joinEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid code' };
  }

  const code = normalizeEventCode(parsed.data.code);

  const [event] = await db
    .select({ id: events.id, code: events.eventCode, status: events.status })
    .from(events)
    .where(eq(events.eventCode, code))
    .limit(1);

  if (!event) {
    return { ok: false, error: 'No event found with that code' };
  }

  if (event.status === 'archived') {
    return { ok: false, error: 'That event has been archived' };
  }

  const sessionId = await ensureSessionId();
  const displayName = parsed.data.displayName?.trim() || null;

  const [existing] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(eq(participants.eventId, event.id), eq(participants.sessionId, sessionId)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(participants)
      .set({
        lastSeenAt: new Date(),
        // Keep the stored name unless a new one was supplied.
        ...(displayName ? { displayName } : {}),
      })
      .where(eq(participants.id, existing.id));
  } else {
    await db.insert(participants).values({
      eventId: event.id,
      sessionId,
      displayName,
    });

    await publish(channels.event(event.id), RealtimeEvent.ParticipantJoined, {
      eventId: event.id,
    });
  }

  redirect(`/event/${event.code}`);
}
