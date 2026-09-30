import 'server-only';
import { and, asc, count, desc, eq } from 'drizzle-orm';
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
import { nextDueAt, quizPacing, quizPhase, type QuizPhase } from '@/lib/quiz/pacing';

export type QuizQuestion = {
  id: string;
  title: string;
  position: number;
  settings: InteractionSettings;
  /** When the question opens for answers. In the future during "get ready". */
  startedAt: Date | null;
  /** When its answer was revealed; null until then. */
  revealedAt: Date | null;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
    position: number;
    /** How many players chose it. Host screens show this once revealed. */
    picks: number;
  }[];
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
  // Every screen reloads this on every change in the room, so it is one round
  // trip to the database whatever the number of questions: all four queries
  // are keyed on the quiz and sent together.
  const [[quiz], children, options, answers] = await Promise.all([
    db
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
      .limit(1),

    db
      .select({
        id: interactions.id,
        title: interactions.title,
        position: interactions.position,
        settings: interactions.settings,
        startedAt: interactions.startedAt,
        // A question's `endedAt` is stamped when its answer is revealed.
        revealedAt: interactions.endedAt,
      })
      .from(interactions)
      .where(eq(interactions.parentId, quizId))
      .orderBy(asc(interactions.position), asc(interactions.createdAt)),

    db
      .select({
        questionId: interactionOptions.interactionId,
        id: interactionOptions.id,
        text: interactionOptions.text,
        isCorrect: interactionOptions.isCorrect,
        position: interactionOptions.position,
      })
      .from(interactionOptions)
      .innerJoin(interactions, eq(interactions.id, interactionOptions.interactionId))
      .where(eq(interactions.parentId, quizId))
      .orderBy(asc(interactionOptions.position)),

    db
      .select({ questionId: responses.interactionId, data: responses.responseData })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .where(eq(interactions.parentId, quizId)),
  ]);

  if (!quiz || quiz.type !== 'quiz') return null;

  const picks = new Map<string, number>();
  const answerCounts = new Map<string, number>();
  for (const answer of answers) {
    answerCounts.set(answer.questionId, (answerCounts.get(answer.questionId) ?? 0) + 1);
    if (answer.data.kind !== 'quiz') continue;
    for (const optionId of answer.data.optionIds) {
      picks.set(optionId, (picks.get(optionId) ?? 0) + 1);
    }
  }

  const questions: QuizQuestion[] = children.map((child) => ({
    ...child,
    options: options
      .filter((option) => option.questionId === child.id)
      .map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect ?? false,
        position: option.position,
        picks: picks.get(option.id) ?? 0,
      })),
    answerCount: answerCounts.get(child.id) ?? 0,
  }));

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

/**
 * Where a quiz is in its run and when it next moves on by itself.
 *
 * One place derives this for the projector, the dashboard and the phones, so
 * they cannot disagree about what phase the room is in.
 */
export function quizTiming(
  quiz: QuizDetail,
  hasScores: boolean,
): { phase: QuizPhase; dueAt: number | null } {
  const current = quiz.questions.find((q) => q.id === quiz.currentChildId) ?? null;

  const phase = quizPhase({
    status: quiz.status,
    hasCurrentQuestion: Boolean(current),
    answerRevealed: quiz.answerRevealed,
    hasScores,
  });

  const dueAt = nextDueAt({
    pacing: quizPacing(quiz.settings),
    phase,
    startedAt: current?.startedAt ?? null,
    revealedAt: current?.revealedAt ?? null,
    timeLimitSeconds: current?.settings.timeLimitSeconds,
  });

  return { phase, dueAt };
}

export type LobbyPlayer = { id: string; displayName: string | null };

/**
 * The players to show joining, oldest first so names hold their place on
 * screen as new ones arrive, plus the true total when the list is capped.
 */
export async function getLobbyPlayers(
  eventId: string,
  limit = 60,
): Promise<{ players: LobbyPlayer[]; total: number }> {
  const [players, [{ total }]] = await Promise.all([
    db
      .select({ id: participants.id, displayName: participants.displayName })
      .from(participants)
      .where(eq(participants.eventId, eventId))
      .orderBy(asc(participants.joinedAt))
      .limit(limit),
    db.select({ total: count() }).from(participants).where(eq(participants.eventId, eventId)),
  ]);

  return { players, total };
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
  const [rows, answers] = await Promise.all([
    db
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
      .orderBy(desc(quizScores.score), asc(quizScores.totalTime)),

    sinceQuestionId
      ? db
          .select({ participantId: responses.participantId, data: responses.responseData })
          .from(responses)
          .where(eq(responses.interactionId, sinceQuestionId))
      : [],
  ]);

  const previousRanks = new Map<string, number>();

  if (sinceQuestionId) {

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
  phase: QuizPhase;
  /** When the quiz next moves on by itself (epoch ms), or null if it waits for the host. */
  dueAt: number | null;
  /** Whether another question follows the one on screen. */
  hasNext: boolean;
  /** Everyone who has joined the event, for the lobby. */
  playerCount: number;
  question: {
    id: string;
    title: string;
    timeLimitSeconds: number;
    startedAt: Date | null;
    options: { id: string; text: string }[];
    /**
     * Whether more than one answer is correct, so the phone knows to let the
     * player pick several. It says how to answer, not what the answer is.
     */
    multiple: boolean;
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

  const [[answer], [score], [{ playerCount }]] = await Promise.all([
    current
      ? db
          .select({ data: responses.responseData })
          .from(responses)
          .where(
            and(
              eq(responses.interactionId, current.id),
              eq(responses.participantId, participantId),
            ),
          )
          .limit(1)
      : [],

    db
      .select({ score: quizScores.score, correctAnswers: quizScores.correctAnswers })
      .from(quizScores)
      .where(
        and(eq(quizScores.quizId, quizId), eq(quizScores.participantId, participantId)),
      )
      .limit(1),

    db
      .select({ playerCount: count() })
      .from(participants)
      .where(eq(participants.eventId, quiz.eventId)),
  ]);

  const myAnswer: ParticipantQuizView['myAnswer'] =
    answer && answer.data.kind === 'quiz'
      ? {
          optionIds: answer.data.optionIds,
          correct: answer.data.correct,
          points: answer.data.points,
        }
      : null;

  const timing = quizTiming(quiz, Boolean(score));

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    status: quiz.status,
    answerRevealed: quiz.answerRevealed,
    totalQuestions: quiz.questions.length,
    questionNumber,
    phase: timing.phase,
    dueAt: timing.dueAt,
    hasNext: questionNumber !== null && questionNumber < quiz.questions.length,
    playerCount,
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
          multiple: current.options.filter((option) => option.isCorrect).length > 1,
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
