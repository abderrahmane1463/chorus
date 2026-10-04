'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, participants } from '@/db/schema';
import { ensureSessionId, readSessionId } from '@/lib/participant/session';
import { normalizeEventCode } from '@/lib/utils/event-code';
import { joinEventSchema, nicknameSchema } from '@/lib/validations/user';
import { seenNow } from '@/lib/queries/presence';
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
  // Resolved here rather than returned as a key, so every caller keeps
  // receiving a sentence it can show as-is.
  const t = await getTranslations();

  const parsed = joinEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t(parsed.error.issues[0]?.message ?? 'validation.codeRequired') };
  }

  const code = normalizeEventCode(parsed.data.code);

  const [event] = await db
    .select({ id: events.id, code: events.eventCode, status: events.status })
    .from(events)
    .where(eq(events.eventCode, code))
    .limit(1);

  if (!event) {
    return { ok: false, error: t('errors.noEventWithCode') };
  }

  if (event.status === 'archived') {
    return { ok: false, error: t('errors.eventArchived') };
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
        lastSeenAt: seenNow,
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

/**
 * Gives a participant a name after they have joined.
 *
 * Joining never requires one, because polls and Q&A are better anonymous. A
 * quiz is different: its scoreboard is the point, so the lobby asks. The
 * participant is found by their own signed session, never by an id the
 * browser sends, so nobody can rename someone else.
 */
export async function setNicknameAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();

  const parsed = nicknameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t(parsed.error.issues[0]?.message ?? 'validation.nicknameRequired'),
    };
  }

  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: t('errors.notPartOfEvent') };

  const updated = await db
    .update(participants)
    .set({ displayName: parsed.data.displayName, lastSeenAt: seenNow })
    .where(
      and(
        eq(participants.eventId, parsed.data.eventId),
        eq(participants.sessionId, sessionId),
      ),
    )
    .returning({ id: participants.id });

  if (updated.length === 0) return { ok: false, error: t('errors.notPartOfEvent') };

  // The lobby on the projector lists names, so it needs to hear about this one.
  await publish(channels.event(parsed.data.eventId), RealtimeEvent.ParticipantJoined, {
    eventId: parsed.data.eventId,
  });

  return { ok: true };
}
