'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  events,
  interactionOptions,
  interactions,
  participants,
  quizScores,
  responses,
} from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { readSessionId } from '@/lib/participant/session';
import { assertQuizOwner, getQuizDetail } from '@/lib/queries/quiz';
import {
  ANSWER_GRACE_MS,
  computeScore,
  DEFAULT_QUIZ_POINTS,
  DEFAULT_TIME_LIMIT_SECONDS,
  isAnswerCorrect,
} from '@/lib/quiz/scoring';
import {
  quizControlSchema,
  quizIdSchema,
  saveQuizQuestionSchema,
  submitQuizAnswerSchema,
  quizQuestionIdSchema,
} from '@/lib/validations/quiz';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { ActionResult } from './auth';

/** Adds an empty question to a quiz, ready to be filled in. */
export async function addQuizQuestionAction(
  input: unknown,
): Promise<ActionResult & { questionId?: string }> {
  const user = await requireUser();

  const parsed = quizIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid quiz' };

  const owned = await assertQuizOwner(parsed.data.quizId, user.id);
  if (!owned) return { ok: false, error: 'Quiz not found' };

  const [{ highest }] = await db
    .select({ highest: max(interactions.position) })
    .from(interactions)
    .where(eq(interactions.parentId, owned.id));

  const [created] = await db
    .insert(interactions)
    .values({
      eventId: owned.eventId,
      parentId: owned.id,
      // Quiz questions are multiple choice with correctness flags on options.
      type: 'multiple_choice',
      title: '',
      position: (highest ?? -1) + 1,
      settings: {
        timeLimitSeconds: DEFAULT_TIME_LIMIT_SECONDS,
        points: DEFAULT_QUIZ_POINTS,
        speedBonus: true,
      },
    })
    .returning({ id: interactions.id });

  await db.insert(interactionOptions).values([
    { interactionId: created.id, text: '', position: 0, isCorrect: true },
    { interactionId: created.id, text: '', position: 1, isCorrect: false },
  ]);

  revalidatePath(`/dashboard/events/${owned.eventId}`);
  return { ok: true, questionId: created.id };
}

export async function saveQuizQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = saveQuizQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid question' };
  }

  const filled = parsed.data.options.filter((o) => o.text.trim().length > 0);
  if (filled.length < 2) return { ok: false, error: 'Add at least two answers' };
  if (!filled.some((o) => o.isCorrect)) {
    return { ok: false, error: 'Mark at least one answer as correct' };
  }

  // The question is a child interaction, so ownership runs through its parent.
  const [question] = await db
    .select({
      id: interactions.id,
      eventId: interactions.eventId,
      parentId: interactions.parentId,
    })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(
      and(eq(interactions.id, parsed.data.questionId), eq(events.ownerId, user.id)),
    )
    .limit(1);

  if (!question?.parentId) return { ok: false, error: 'Question not found' };

  await db
    .update(interactions)
    .set({
      title: parsed.data.title,
      settings: {
        timeLimitSeconds: parsed.data.timeLimitSeconds,
        points: parsed.data.points,
        speedBonus: parsed.data.speedBonus,
        explanation: parsed.data.explanation?.trim() || undefined,
      },
      updatedAt: new Date(),
    })
    .where(eq(interactions.id, question.id));

  const keptIds = new Set(filled.map((o) => o.id).filter(Boolean));
  const existing = await db
    .select({ id: interactionOptions.id })
    .from(interactionOptions)
    .where(eq(interactionOptions.interactionId, question.id));

  for (const option of existing) {
    if (!keptIds.has(option.id)) {
      await db.delete(interactionOptions).where(eq(interactionOptions.id, option.id));
    }
  }

  for (const [index, option] of filled.entries()) {
    if (option.id) {
      await db
        .update(interactionOptions)
        .set({ text: option.text.trim(), position: index, isCorrect: option.isCorrect })
        .where(eq(interactionOptions.id, option.id));
    } else {
      await db.insert(interactionOptions).values({
        interactionId: question.id,
        text: option.text.trim(),
        position: index,
        isCorrect: option.isCorrect,
      });
    }
  }

  revalidatePath(`/dashboard/events/${question.eventId}`);
  return { ok: true };
}

export async function deleteQuizQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = quizQuestionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid question' };

  const [question] = await db
    .select({ id: interactions.id, eventId: interactions.eventId })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(and(eq(interactions.id, parsed.data.questionId), eq(events.ownerId, user.id)))
    .limit(1);

  if (!question) return { ok: false, error: 'Question not found' };

  await db.delete(interactions).where(eq(interactions.id, question.id));
  revalidatePath(`/dashboard/events/${question.eventId}`);
  return { ok: true };
}

/**
 * Drives the quiz: start, advance, reveal, finish, restart.
 *
 * Advancing stamps the new question's `startedAt` on the server. That
 * timestamp is what scoring measures against, so a participant cannot earn a
 * speed bonus by lying about when they saw the question.
 */
export async function controlQuizAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = quizControlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid quiz action' };

  const owned = await assertQuizOwner(parsed.data.quizId, user.id);
  if (!owned) return { ok: false, error: 'Quiz not found' };

  const quiz = await getQuizDetail(owned.id);
  if (!quiz) return { ok: false, error: 'Quiz not found' };

  if (quiz.questions.length === 0) {
    return { ok: false, error: 'Add at least one question first' };
  }

  const currentIndex = quiz.questions.findIndex((q) => q.id === quiz.currentChildId);

  switch (parsed.data.action) {
    case 'start':
    case 'restart': {
      if (parsed.data.action === 'restart') {
        const childIds = quiz.questions.map((q) => q.id);
        await db
          .delete(responses)
          .where(inArray(responses.interactionId, childIds));
        await db.delete(quizScores).where(eq(quizScores.quizId, quiz.id));
      }

      // A quiz is the one live interaction while it runs.
      await db
        .update(interactions)
        .set({ status: 'closed', endedAt: new Date() })
        .where(
          and(
            eq(interactions.eventId, owned.eventId),
            eq(interactions.status, 'active'),
            isNull(interactions.parentId),
          ),
        );

      const first = quiz.questions[0];
      await db
        .update(interactions)
        .set({ startedAt: new Date() })
        .where(eq(interactions.id, first.id));

      await db
        .update(interactions)
        .set({
          status: 'active',
          startedAt: new Date(),
          endedAt: null,
          currentChildId: first.id,
          answerRevealed: false,
        })
        .where(eq(interactions.id, quiz.id));

      await db
        .update(events)
        .set({ activeInteractionId: quiz.id })
        .where(eq(events.id, owned.eventId));

      await publishQuiz(owned.eventId, quiz.id, RealtimeEvent.QuizStarted);
      break;
    }

    case 'next': {
      const next = quiz.questions[currentIndex + 1];
      if (!next) return { ok: false, error: 'That was the last question' };

      await db
        .update(interactions)
        .set({ startedAt: new Date() })
        .where(eq(interactions.id, next.id));

      await db
        .update(interactions)
        .set({ currentChildId: next.id, answerRevealed: false })
        .where(eq(interactions.id, quiz.id));

      await publishQuiz(owned.eventId, quiz.id, RealtimeEvent.QuizQuestionChanged);
      break;
    }

    case 'reveal': {
      await db
        .update(interactions)
        .set({ answerRevealed: true })
        .where(eq(interactions.id, quiz.id));

      await publishQuiz(owned.eventId, quiz.id, RealtimeEvent.QuizAnswerRevealed);
      break;
    }

    case 'finish': {
      await db
        .update(interactions)
        .set({
          status: 'closed',
          endedAt: new Date(),
          currentChildId: null,
          answerRevealed: true,
        })
        .where(eq(interactions.id, quiz.id));

      // `activeInteractionId` deliberately still points at the quiz: the room
      // needs to keep seeing the final leaderboard until the host moves on to
      // something else, rather than dropping to an empty screen.

      await publishQuiz(owned.eventId, quiz.id, RealtimeEvent.QuizFinished);
      break;
    }
  }

  revalidatePath(`/dashboard/events/${owned.eventId}`);
  return { ok: true };
}

async function publishQuiz(
  eventId: string,
  quizId: string,
  event: (typeof RealtimeEvent)[keyof typeof RealtimeEvent],
) {
  await publish(channels.quiz(eventId), event, { eventId, interactionId: quizId });
  await publish(channels.event(eventId), event, { eventId, interactionId: quizId });
}

/**
 * Records a participant's quiz answer and updates their running score.
 *
 * Correctness and points are computed here from the stored options and the
 * server-side question start time. The client sends only which options it
 * picked.
 */
export async function submitQuizAnswerAction(input: unknown): Promise<ActionResult> {
  const parsed = submitQuizAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid answer' };

  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'Join the event again to answer' };

  const [context] = await db
    .select({
      questionId: interactions.id,
      parentId: interactions.parentId,
      settings: interactions.settings,
      startedAt: interactions.startedAt,
      eventId: events.id,
      eventCode: events.eventCode,
      participantId: participants.id,
    })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .innerJoin(
      participants,
      and(eq(participants.eventId, events.id), eq(participants.sessionId, sessionId)),
    )
    .where(eq(interactions.id, parsed.data.questionId))
    .limit(1);

  if (!context?.parentId) return { ok: false, error: 'That question is not part of a quiz' };

  // The quiz must be running and showing exactly this question.
  const [quiz] = await db
    .select({
      id: interactions.id,
      status: interactions.status,
      currentChildId: interactions.currentChildId,
      answerRevealed: interactions.answerRevealed,
    })
    .from(interactions)
    .where(eq(interactions.id, context.parentId))
    .limit(1);

  if (!quiz || quiz.status !== 'active') {
    return { ok: false, error: 'This quiz is not running' };
  }
  if (quiz.currentChildId !== context.questionId) {
    return { ok: false, error: 'That question has moved on' };
  }
  if (quiz.answerRevealed) {
    return { ok: false, error: 'The answer has already been revealed' };
  }

  const timeLimitSeconds = context.settings.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS;
  const startedAt = context.startedAt?.getTime() ?? Date.now();
  const elapsedMs = Date.now() - startedAt;

  if (elapsedMs > timeLimitSeconds * 1000 + ANSWER_GRACE_MS) {
    return { ok: false, error: 'Time is up for this question' };
  }

  const options = await db
    .select({ id: interactionOptions.id, isCorrect: interactionOptions.isCorrect })
    .from(interactionOptions)
    .where(eq(interactionOptions.interactionId, context.questionId));

  const validIds = new Set(options.map((o) => o.id));
  if (!parsed.data.optionIds.every((id) => validIds.has(id))) {
    return { ok: false, error: 'That answer is not valid' };
  }

  const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
  const correct = isAnswerCorrect(parsed.data.optionIds, correctIds);

  const points = computeScore({
    correct,
    elapsedMs,
    timeLimitSeconds,
    basePoints: context.settings.points ?? DEFAULT_QUIZ_POINTS,
    speedBonus: context.settings.speedBonus ?? true,
  });

  // One answer per question, enforced by the slot-0 unique constraint.
  const inserted = await db
    .insert(responses)
    .values({
      interactionId: context.questionId,
      participantId: context.participantId,
      slot: 0,
      responseData: {
        kind: 'quiz',
        optionIds: parsed.data.optionIds,
        answeredAtMs: elapsedMs,
        correct,
        points,
      },
    })
    .onConflictDoNothing()
    .returning({ id: responses.id });

  if (inserted.length === 0) {
    return { ok: false, error: 'You have already answered this question' };
  }

  await db
    .insert(quizScores)
    .values({
      quizId: quiz.id,
      participantId: context.participantId,
      score: points,
      correctAnswers: correct ? 1 : 0,
      totalTime: elapsedMs,
    })
    .onConflictDoUpdate({
      target: [quizScores.quizId, quizScores.participantId],
      set: {
        score: sql`${quizScores.score} + ${points}`,
        correctAnswers: sql`${quizScores.correctAnswers} + ${correct ? 1 : 0}`,
        totalTime: sql`${quizScores.totalTime} + ${elapsedMs}`,
        updatedAt: new Date(),
      },
    });

  await publishQuiz(context.eventId, quiz.id, RealtimeEvent.ResponseCreated);

  revalidatePath(`/event/${context.eventCode}`);
  revalidatePath(`/dashboard/events/${context.eventId}`);
  return { ok: true };
}
