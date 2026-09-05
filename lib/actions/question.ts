'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, interactions, participants, questionVotes, questions } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { readSessionId } from '@/lib/participant/session';
import {
  askQuestionSchema,
  moderateQuestionSchema,
  questionIdSchema,
} from '@/lib/validations/question';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { ActionResult } from './auth';

/**
 * Resolves the interaction, its event, and the calling participant in one
 * query. A missing row means the interaction does not exist or this session
 * never joined that event — both are "you cannot post here".
 */
async function participantContext(interactionId: string) {
  const sessionId = await readSessionId();
  if (!sessionId) return null;

  const [row] = await db
    .select({
      interactionId: interactions.id,
      type: interactions.type,
      status: interactions.status,
      settings: interactions.settings,
      eventId: events.id,
      eventCode: events.eventCode,
      eventStatus: events.status,
      participantId: participants.id,
    })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .innerJoin(
      participants,
      and(eq(participants.eventId, events.id), eq(participants.sessionId, sessionId)),
    )
    .where(eq(interactions.id, interactionId))
    .limit(1);

  return row ?? null;
}

export async function askQuestionAction(input: unknown): Promise<ActionResult> {
  const parsed = askQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid question' };
  }

  const context = await participantContext(parsed.data.interactionId);
  if (!context) return { ok: false, error: 'You are not part of this event' };
  if (context.type !== 'q_and_a') return { ok: false, error: 'That is not a Q&A' };
  if (context.eventStatus === 'archived') {
    return { ok: false, error: 'This event is closed' };
  }
  if (context.status !== 'active') {
    return { ok: false, error: 'Q&A is not open right now' };
  }

  // Anonymity is only honoured if the host allows it.
  const allowAnonymous = context.settings.allowAnonymous ?? true;
  const isAnonymous = allowAnonymous ? parsed.data.isAnonymous : false;

  // With moderation on, the room does not see the question until approved.
  const status = context.settings.moderationEnabled ? 'pending' : 'approved';

  const [created] = await db
    .insert(questions)
    .values({
      eventId: context.eventId,
      interactionId: context.interactionId,
      participantId: context.participantId,
      text: parsed.data.text,
      isAnonymous,
      status,
    })
    .returning({ id: questions.id });

  await publish(channels.qa(context.eventId), RealtimeEvent.QuestionCreated, {
    eventId: context.eventId,
    interactionId: context.interactionId,
    questionId: created.id,
  });

  revalidatePath(`/event/${context.eventCode}`);
  revalidatePath(`/dashboard/events/${context.eventId}`);
  return { ok: true };
}

/** Upvotes are a toggle; the unique constraint makes double-voting impossible. */
export async function toggleQuestionVoteAction(input: unknown): Promise<ActionResult> {
  const parsed = questionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid question' };

  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'Join the event again to vote' };

  const [target] = await db
    .select({
      questionId: questions.id,
      status: questions.status,
      interactionId: questions.interactionId,
      settings: interactions.settings,
      eventId: events.id,
      eventCode: events.eventCode,
      participantId: participants.id,
    })
    .from(questions)
    .innerJoin(events, eq(events.id, questions.eventId))
    .innerJoin(interactions, eq(interactions.id, questions.interactionId))
    .innerJoin(
      participants,
      and(eq(participants.eventId, events.id), eq(participants.sessionId, sessionId)),
    )
    .where(eq(questions.id, parsed.data.questionId))
    .limit(1);

  if (!target) return { ok: false, error: 'You are not part of this event' };
  if ((target.settings.allowUpvotes ?? true) === false) {
    return { ok: false, error: 'Upvotes are turned off for this Q&A' };
  }
  if (target.status !== 'approved' && target.status !== 'answered') {
    return { ok: false, error: 'That question is not open for votes' };
  }

  const removed = await db
    .delete(questionVotes)
    .where(
      and(
        eq(questionVotes.questionId, target.questionId),
        eq(questionVotes.participantId, target.participantId),
      ),
    )
    .returning({ id: questionVotes.id });

  if (removed.length === 0) {
    await db.insert(questionVotes).values({
      questionId: target.questionId,
      participantId: target.participantId,
    });
  }

  await publish(channels.qa(target.eventId), RealtimeEvent.QuestionUpvoted, {
    eventId: target.eventId,
    questionId: target.questionId,
  });

  revalidatePath(`/event/${target.eventCode}`);
  revalidatePath(`/dashboard/events/${target.eventId}`);
  return { ok: true };
}

/** Host-only moderation. Ownership is enforced inside the query, not after it. */
export async function moderateQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = moderateQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid moderation action' };

  const [target] = await db
    .select({ id: questions.id, eventId: questions.eventId })
    .from(questions)
    .innerJoin(events, eq(events.id, questions.eventId))
    .where(and(eq(questions.id, parsed.data.questionId), eq(events.ownerId, user.id)))
    .limit(1);

  if (!target) return { ok: false, error: 'Question not found' };

  if (parsed.data.action === 'delete') {
    await db.delete(questions).where(eq(questions.id, target.id));
  } else if (parsed.data.action === 'highlight') {
    // Only one question is spotlighted on the presenter screen at a time.
    await db
      .update(questions)
      .set({ isHighlighted: false })
      .where(eq(questions.eventId, target.eventId));

    await db
      .update(questions)
      .set({ isHighlighted: true })
      .where(eq(questions.id, target.id));
  } else if (parsed.data.action === 'unhighlight') {
    await db
      .update(questions)
      .set({ isHighlighted: false })
      .where(eq(questions.id, target.id));
  } else {
    await db
      .update(questions)
      .set({ status: parsed.data.action })
      .where(eq(questions.id, target.id));
  }

  await publish(channels.qa(target.eventId), RealtimeEvent.QuestionUpdated, {
    eventId: target.eventId,
    questionId: target.id,
  });

  revalidatePath(`/dashboard/events/${target.eventId}`);
  return { ok: true };
}
