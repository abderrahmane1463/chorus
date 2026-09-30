import type { InteractionSettings } from '@/types/interactions';
import { DEFAULT_TIME_LIMIT_SECONDS } from './scoring';

/**
 * The quiz's rhythm, shared by the server that enforces it and the screens
 * that show it.
 *
 * A run goes: lobby, then for each question a short "get ready", the timed
 * question, and the answer with the standings. With automatic pacing the quiz
 * moves through those on its own clock once the host has pressed Start.
 */

/**
 * Shown before each question opens, so nobody is answering while still reading.
 *
 * Longer than it needs to look: the start is stamped when the server moves
 * on, and a screen only hears about it a second or two later, so part of
 * this has already passed by the time the room sees "get ready".
 */
export const GET_READY_SECONDS = 5;

/**
 * How far ahead of a deadline a host screen asks the server to move on. The
 * server holds the request until the moment itself.
 */
export const PROMPT_LEAD_MS = 1200;

/** A request arriving within this long before a deadline is held, not refused. */
export const EARLY_WINDOW_MS = 2500;

/** How long after the buzzer the answer appears, for answers still in flight. */
export const REVEAL_SLACK_MS = 600;

/** How long the answer and standings stay up before the next question. */
export const DEFAULT_REVEAL_SECONDS = 8;
export const MIN_REVEAL_SECONDS = 3;
export const MAX_REVEAL_SECONDS = 60;

export type QuizPacing = {
  /** Reveal at the buzzer and move on without the host. */
  autoAdvance: boolean;
  revealSeconds: number;
};

export function quizPacing(settings: InteractionSettings): QuizPacing {
  const seconds = settings.revealSeconds ?? DEFAULT_REVEAL_SECONDS;
  return {
    autoAdvance: settings.autoAdvance ?? true,
    revealSeconds: Math.min(Math.max(seconds, MIN_REVEAL_SECONDS), MAX_REVEAL_SECONDS),
  };
}

export type QuizPhase = 'idle' | 'lobby' | 'question' | 'revealed' | 'finished';

type PhaseInput = {
  status: 'draft' | 'active' | 'closed';
  hasCurrentQuestion: boolean;
  answerRevealed: boolean;
  /** Whether anyone has a score, which tells a finished run from a quiz never played. */
  hasScores: boolean;
};

export function quizPhase(input: PhaseInput): QuizPhase {
  if (input.status === 'active') {
    if (!input.hasCurrentQuestion) return 'lobby';
    return input.answerRevealed ? 'revealed' : 'question';
  }
  return input.status === 'closed' && input.hasScores ? 'finished' : 'idle';
}

type DueInput = {
  pacing: QuizPacing;
  phase: QuizPhase;
  /** When the current question opens for answers. */
  startedAt: Date | null;
  /** When its answer was revealed. */
  revealedAt: Date | null;
  timeLimitSeconds: number | undefined;
};

/**
 * The moment the quiz should next move on by itself, in epoch milliseconds,
 * or null when it is waiting for the host.
 */
export function nextDueAt(input: DueInput): number | null {
  if (!input.pacing.autoAdvance) return null;

  if (input.phase === 'question' && input.startedAt) {
    const limit = input.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS;
    return input.startedAt.getTime() + limit * 1000;
  }

  if (input.phase === 'revealed') {
    // A reveal with no timestamp predates automatic pacing; it is simply due.
    const revealedAt = input.revealedAt?.getTime() ?? 0;
    return revealedAt + input.pacing.revealSeconds * 1000;
  }

  return null;
}
