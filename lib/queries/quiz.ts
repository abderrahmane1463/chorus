import 'server-only';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  events,
  interactionOptions,
  interactions,
  participants,
  quizScores,
  responses,
} from '@/db/schema';
import type { InteractionSettings } from '@/types/interactions';

export type QuizQuestion = {
  id: string;
  title: string;
  position: number;
  settings: InteractionSettings;
  startedAt: Date | null;
  options: { id: string; text: string; isCorrect: boolean; position: number }[];
  answerCount: number;
};

export type QuizDetail = {
  id: string;
  eventId: string;
  title: string;
  status: 'draft' | 'active' | 'closed';
  settings: InteractionSettings;
  currentChildId: string | null;
  answerRevealed: boolean;
  questions: QuizQuestion[];
};

/** Loads a quiz and its child questions. Options include the correct flags. */
export async function getQuizDetail(quizId: string): Promise<QuizDetail | null> {
  const [quiz] = await db
    .select({
      id: interactions.id,
      eventId: interactions.eventId,
      title: interactions.title,
      status: interactions.status,
      settings: interactions.settings,
      currentChildId: interactions.currentChildId,
      answerRevealed: interactions.answerRevealed,
      type: interactions.type,
    })
    .from(interactions)
    .where(eq(interactions.id, quizId))
    .limit(1);

  if (!quiz || quiz.type !== 'quiz') return null;

  const children = await db
    .select({
      id: interactions.id,
      title: interactions.title,
      position: interactions.position,
      settings: interactions.settings,
      startedAt: interactions.startedAt,
    })
    .from(interactions)
    .where(eq(interactions.parentId, quizId))
    .orderBy(asc(interactions.position), asc(interactions.createdAt));

  const questions: QuizQuestion[] = [];

  for (const child of children) {
    const [options, answers] = await Promise.all([
      db
        .select({
          id: interactionOptions.id,
          text: interactionOptions.text,
          isCorrect: interactionOptions.isCorrect,
          position: interactionOptions.position,
        })
        .from(interactionOptions)
        .where(eq(interactionOptions.interactionId, child.id))
        .orderBy(asc(interactionOptions.position)),

      db
        .select({ id: responses.id })
        .from(responses)
        .where(eq(responses.interactionId, child.id)),
    ]);

    questions.push({
      ...child,
      options: options.map((option) => ({
        ...option,
        isCorrect: option.isCorrect ?? false,
      })),
      answerCount: answers.length,
    });
  }

  return {
    id: quiz.id,
    eventId: quiz.eventId,
    title: quiz.title,
    status: quiz.status,
    settings: quiz.settings,
    currentChildId: quiz.currentChildId,
    answerRevealed: quiz.answerRevealed,
    questions,
  };
}

export type LeaderboardRow = {
  participantId: string;
  displayName: string | null;
  score: number;
  correctAnswers: number;
  totalTime: number;
  rank: number;
  /**
   * Where this player stood before the question named in `sinceQuestionId`.
   * Null when no question was given, or when they were not on the board yet.
   */
  previousRank: number | null;
};

/**
 * Ranked standings. Ties on score are broken by total answering time, so the
 * faster player places higher rather than the ordering being arbitrary.
 *
 * Pass `sinceQuestionId` to also learn how each player moved on that question.
 * The earlier standings are derived by subtracting what the question awarded,
 * not remembered by the client: a leaderboard that has just appeared, or a
 * phone that reloaded, still knows who climbed.
 */
export async function getLeaderboard(
  quizId: string,
  limit = 50,
  sinceQuestionId?: string | null,
): Promise<LeaderboardRow[]> {
  // Unlimited here: ranks before the question must be computed over everyone,
  // or a player outside the top few could never be seen climbing into it.
  const rows = await db
    .select({
      participantId: quizScores.participantId,
      displayName: participants.displayName,
      score: quizScores.score,
      correctAnswers: quizScores.correctAnswers,
      totalTime: quizScores.totalTime,
    })
    .from(quizScores)
    .innerJoin(participants, eq(participants.id, quizScores.participantId))
    .where(eq(quizScores.quizId, quizId))
    .orderBy(desc(quizScores.score), asc(quizScores.totalTime));

  const previousRanks = new Map<string, number>();

  if (sinceQuestionId) {
    const answers = await db
      .select({ participantId: responses.participantId, data: responses.responseData })
      .from(responses)
      .where(eq(responses.interactionId, sinceQuestionId));

    const awarded = new Map<string, { points: number; ms: number }>();
    for (const answer of answers) {
      if (answer.data.kind === 'quiz') {
        awarded.set(answer.participantId, {
          points: answer.data.points,
          ms: answer.data.answeredAtMs,
        });
      }
    }

    const before = rows
      .map((row) => {
        const earned = awarded.get(row.participantId);
        return {
          participantId: row.participantId,
          score: row.score - (earned?.points ?? 0),
          time: row.totalTime - (earned?.ms ?? 0),
          // Someone whose only answer so far is this one had no standing yet.
          onBoard: !earned || row.totalTime - earned.ms > 0,
        };
      })
      .filter((row) => row.onBoard)
      .sort((a, b) => b.score - a.score || a.time - b.time);

    before.forEach((row, index) => previousRanks.set(row.participantId, index + 1));
  }

  return rows.slice(0, limit).map((row, index) => ({
    ...row,
    rank: index + 1,
    previousRank: previousRanks.get(row.participantId) ?? null,
  }));
}

export type ParticipantQuizView = {
  quizId: string;
  quizTitle: string;
  status: 'draft' | 'active' | 'closed';
  answerRevealed: boolean;
  totalQuestions: number;
  questionNumber: number | null;
  question: {
    id: string;
    title: string;
    timeLimitSeconds: number;
    startedAt: Date | null;
    options: { id: string; text: string }[];
    /** Only populated once the host reveals the answer. */
    correctOptionIds: string[];
    explanation: string | null;
  } | null;
  myAnswer: { optionIds: string[]; correct: boolean; points: number } | null;
  myScore: { score: number; correctAnswers: number } | null;
};

/**
 * What one participant should currently see of a quiz.
 *
 * Correct answers are withheld until the host reveals them — the flags never
 * reach the browser early, so they cannot be read out of the page source.
 */
export async function getParticipantQuizView(
  quizId: string,
  participantId: string,
): Promise<ParticipantQuizView | null> {
  const quiz = await getQuizDetail(quizId);
  if (!quiz) return null;

  const current = quiz.questions.find((q) => q.id === quiz.currentChildId) ?? null;
  const questionNumber = current
    ? quiz.questions.findIndex((q) => q.id === current.id) + 1
    : null;

  let myAnswer: ParticipantQuizView['myAnswer'] = null;
  if (current) {
    const [row] = await db
      .select({ data: responses.responseData })
      .from(responses)
      .where(
        and(
          eq(responses.interactionId, current.id),
          eq(responses.participantId, participantId),
        ),
      )
      .limit(1);

    if (row && row.data.kind === 'quiz') {
      myAnswer = {
        optionIds: row.data.optionIds,
        correct: row.data.correct,
        points: row.data.points,
      };
    }
  }

  const [score] = await db
    .select({ score: quizScores.score, correctAnswers: quizScores.correctAnswers })
    .from(quizScores)
    .where(
      and(eq(quizScores.quizId, quizId), eq(quizScores.participantId, participantId)),
    )
    .limit(1);

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    status: quiz.status,
    answerRevealed: quiz.answerRevealed,
    totalQuestions: quiz.questions.length,
    questionNumber,
    question: current
      ? {
          id: current.id,
          title: current.title,
          timeLimitSeconds: current.settings.timeLimitSeconds ?? 20,
          startedAt: current.startedAt,
          options: current.options.map((option) => ({
            id: option.id,
            text: option.text,
          })),
          correctOptionIds: quiz.answerRevealed
            ? current.options.filter((o) => o.isCorrect).map((o) => o.id)
            : [],
          explanation: quiz.answerRevealed
            ? (current.settings.explanation ?? null)
            : null,
        }
      : null,
    myAnswer,
    myScore: score ?? null,
  };
}

/** Confirms the caller owns the event a quiz belongs to. */
export async function assertQuizOwner(quizId: string, userId: string) {
  const [row] = await db
    .select({ id: interactions.id, eventId: interactions.eventId })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(and(eq(interactions.id, quizId), eq(events.ownerId, userId)))
    .limit(1);

  return row ?? null;
}
