'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { and, count, eq, inArray, max, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
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
import {
  advanceIfDue,
  finishQuiz,
  openLobby,
  publishQuiz,
  revealAnswer,
  showQuestion,
} from '@/lib/quiz/flow';
import { quizPacing } from '@/lib/quiz/pacing';
import { RealtimeEvent } from '@/lib/realtime/events';
import type { ActionResult } from './auth';

/** A question and its quiz live in the same table; this names the quiz side of a join. */
const quizzes = alias(interactions, 'quizzes');

/** A phone's clock-corrected tap can land a moment before the server's start. */
const EARLY_TOLERANCE_MS = 300;

/** Adds an empty question to a quiz, ready to be filled in. */
export async function addQuizQuestionAction(
  input: unknown,
): Promise<ActionResult & { questionId?: string }> {
  const t = await getTranslations();

  const user = await requireUser();

  const parsed = quizIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.invalidQuiz') };

  const owned = await assertQuizOwner(parsed.data.quizId, user.id);
  if (!owned) return { ok: false, error: t('errors.quizNotFound') };

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
  const t = await getTranslations();

  const user = await requireUser();

  const parsed = saveQuizQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t(parsed.error.issues[0]?.message ?? 'errors.invalidQuestion') };
  }

  const filled = parsed.data.options.filter((o) => o.text.trim().length > 0);
  if (filled.length < 2) return { ok: false, error: t('errors.addTwoAnswers') };
  if (!filled.some((o) => o.isCorrect)) {
    return { ok: false, error: t('errors.markOneCorrect') };
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

  if (!question?.parentId) return { ok: false, error: t('errors.questionNotFound') };

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
  const t = await getTranslations();

  const user = await requireUser();

  const parsed = quizQuestionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.invalidQuestion') };

  const [question] = await db
    .select({ id: interactions.id, eventId: interactions.eventId })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(and(eq(interactions.id, parsed.data.questionId), eq(events.ownerId, user.id)))
    .limit(1);

  if (!question) return { ok: false, error: t('errors.questionNotFound') };

  await db.delete(interactions).where(eq(interactions.id, question.id));
  revalidatePath(`/dashboard/events/${question.eventId}`);
  return { ok: true };
}

/**
 * The host's controls: open the lobby, start, and the manual overrides.
 *
 * With automatic pacing the host only opens the lobby and presses Start; the
 * quiz reveals and moves on by its own clock (see `advanceIfDue`). Reveal,
 * next and finish remain for skipping ahead, and are the only way forward
 * when automatic pacing is switched off.
 */
export async function controlQuizAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();

  const user = await requireUser();

  const parsed = quizControlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.invalidQuizAction') };

  const owned = await assertQuizOwner(parsed.data.quizId, user.id);
  if (!owned) return { ok: false, error: t('errors.quizNotFound') };

  const quiz = await getQuizDetail(owned.id);
  if (!quiz) return { ok: false, error: t('errors.quizNotFound') };

  if (quiz.questions.length === 0) {
    return { ok: false, error: t('errors.addOneQuestion') };
  }

  const currentIndex = quiz.questions.findIndex((q) => q.id === quiz.currentChildId);
  const current = quiz.questions[currentIndex] ?? null;

  switch (parsed.data.action) {
    case 'restart': {
      const childIds = quiz.questions.map((q) => q.id);
      await db.delete(responses).where(inArray(responses.interactionId, childIds));
      await db.delete(quizScores).where(eq(quizScores.quizId, quiz.id));
      // Back to the lobby rather than straight into question one, so a
      // rehearsal can be cleared without springing a timer on the room.
      await openLobby(quiz.id, owned.eventId);
      break;
    }

    case 'open': {
      await openLobby(quiz.id, owned.eventId);
      break;
    }

    case 'start': {
      // A quiz with nobody in the room has no one to play it. The screens
      // keep Start locked until someone joins; this holds for any other caller.
      const [{ joined }] = await db
        .select({ joined: count() })
        .from(participants)
        .where(eq(participants.eventId, owned.eventId));
      if (joined === 0) return { ok: false, error: t('errors.noPlayersYet') };

      if (quiz.status !== 'active') await openLobby(quiz.id, owned.eventId);
      // From the lobby only: pressing Start twice must not restart question one.
      const started = await showQuestion(quiz.id, owned.eventId, null, quiz.questions[0].id);
      if (!started && quiz.status === 'active' && current) {
        return { ok: false, error: t('errors.quizAlreadyStarted') };
      }
      break;
    }

    case 'next': {
      const next = quiz.questions[currentIndex + 1];
      if (!current || !next) return { ok: false, error: t('errors.lastQuestion') };
      await showQuestion(quiz.id, owned.eventId, current.id, next.id);
      break;
    }

    case 'reveal': {
      if (!current) return { ok: false, error: t('errors.quizNotRunning') };
      await revealAnswer(quiz.id, owned.eventId, current.id);
      break;
    }

    case 'finish': {
      await finishQuiz(quiz.id, owned.eventId, quiz.currentChildId);
      break;
    }
  }

  revalidatePath(`/dashboard/events/${owned.eventId}`);
  return { ok: true };
}

/**
 * Asks the quiz to take a step that its own clock says is due.
 *
 * Open to every screen in the room, participants included, because the quiz
 * must keep moving even if the host's tab is closed. It is safe to expose: a
 * caller cannot choose the step or its timing, only prompt the server to
 * check. See `advanceIfDue`.
 */
export async function syncQuizAction(
  input: unknown,
): Promise<{ ok: true; advanced: boolean } | { ok: false }> {
  const parsed = quizIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const advanced = await advanceIfDue(parsed.data.quizId);
  return { ok: true, advanced };
}

/**
 * Records a participant's quiz answer and updates their running score.
 *
 * Correctness and points are computed here from the stored options and the
 * server-side question start time. The client sends only which options it
 * picked.
 */
export async function submitQuizAnswerAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();

  const parsed = submitQuizAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.invalidAnswer') };

  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: t('errors.rejoinToAnswer') };

  // The question, its quiz and its options are all keyed on the question, so
  // they are asked for together: the time this takes is time the player waits
  // between tapping and seeing the answer counted.
  const [[context], [quiz], options] = await Promise.all([
    db
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
      .limit(1),

    db
      .select({
        id: quizzes.id,
        status: quizzes.status,
        settings: quizzes.settings,
        currentChildId: quizzes.currentChildId,
        answerRevealed: quizzes.answerRevealed,
      })
      .from(interactions)
      .innerJoin(quizzes, eq(quizzes.id, interactions.parentId))
      .where(eq(interactions.id, parsed.data.questionId))
      .limit(1),

    db
      .select({ id: interactionOptions.id, isCorrect: interactionOptions.isCorrect })
      .from(interactionOptions)
      .where(eq(interactionOptions.interactionId, parsed.data.questionId)),
  ]);

  if (!context?.parentId) return { ok: false, error: t('errors.notQuizQuestion') };

  // The quiz must be running and showing exactly this question.
  if (!quiz || quiz.status !== 'active') {
    return { ok: false, error: t('errors.quizNotRunning') };
  }
  if (quiz.currentChildId !== context.questionId) {
    return { ok: false, error: t('errors.questionMovedOn') };
  }
  if (quiz.answerRevealed) {
    return { ok: false, error: t('errors.alreadyRevealed') };
  }

  const timeLimitSeconds = context.settings.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS;
  const startedAt = context.startedAt?.getTime() ?? Date.now();
  const sinceOpen = Date.now() - startedAt;

  // The question is on screen for a few seconds before it opens. The options
  // are already in the page by then, so the phone hiding them is not enough:
  // an answer sent during "get ready" has to be refused here.
  if (sinceOpen < -EARLY_TOLERANCE_MS) {
    return { ok: false, error: t('errors.questionNotOpen') };
  }

  const elapsedMs = Math.max(sinceOpen, 0);

  if (elapsedMs > timeLimitSeconds * 1000 + ANSWER_GRACE_MS) {
    return { ok: false, error: t('errors.timeUp') };
  }

  const validIds = new Set(options.map((o) => o.id));
  if (!parsed.data.optionIds.every((id) => validIds.has(id))) {
    return { ok: false, error: t('errors.answerNotValid') };
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
    return { ok: false, error: t('errors.alreadyAnsweredQuestion') };
  }

  // Counted alongside the score, after the answer is stored so it is included.
  const autoAdvance = quizPacing(quiz.settings).autoAdvance;

  const [, [{ answered }], [{ joined }]] = await Promise.all([
    db
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
      }),
    autoAdvance
      ? db
          .select({ answered: count() })
          .from(responses)
          .where(eq(responses.interactionId, context.questionId))
      : [{ answered: 0 }],
    autoAdvance
      ? db
          .select({ joined: count() })
          .from(participants)
          .where(eq(participants.eventId, context.eventId))
      : [{ joined: 0 }],
  ]);

  // Nobody left to wait for: show the answer now instead of running the clock
  // down on a room that has finished. Counted against everyone who joined, so
  // a player who walked away simply leaves it to the timer.
  const revealed =
    autoAdvance &&
    joined > 0 &&
    answered >= joined &&
    (await revealAnswer(quiz.id, context.eventId, context.questionId));

  // A reveal already tells every screen to reload, which covers this answer.
  if (!revealed) {
    await publishQuiz(context.eventId, quiz.id, RealtimeEvent.ResponseCreated);
  }

  revalidatePath(`/event/${context.eventCode}`);
  revalidatePath(`/dashboard/events/${context.eventId}`);
  return { ok: true };
}
