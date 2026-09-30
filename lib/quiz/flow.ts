import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, interactions } from '@/db/schema';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent, type RealtimeEventName } from '@/lib/realtime/events';
import type { InteractionSettings } from '@/types/interactions';
import {
  EARLY_WINDOW_MS,
  GET_READY_SECONDS,
  nextDueAt,
  quizPacing,
  quizPhase,
  REVEAL_SLACK_MS,
} from './pacing';

/**
 * Moves a quiz through its run.
 *
 * Every step is one guarded statement: it names the state it expects to leave
 * and does nothing if the quiz is no longer there. Any screen in the room may
 * ask for a step that is due, so several will ask at once, and exactly one
 * must win without the others undoing or repeating it.
 */

export async function publishQuiz(eventId: string, quizId: string, event: RealtimeEventName) {
  await publish(channels.quiz(eventId), event, { eventId, interactionId: quizId });
  await publish(channels.event(eventId), event, { eventId, interactionId: quizId });
}

/** True when the statement changed a row, which means this caller won the step. */
function applied(result: { rows?: unknown[]; rowCount?: number | null }): boolean {
  return (result.rows?.length ?? result.rowCount ?? 0) > 0;
}

/**
 * Opens the quiz for joining: the room sees the code and who is in, and no
 * question is showing. Scores from an earlier run are left alone.
 */
export async function openLobby(quizId: string, eventId: string): Promise<void> {
  // A quiz is the one live interaction while it runs.
  await db
    .update(interactions)
    .set({ status: 'closed', endedAt: new Date() })
    .where(
      and(
        eq(interactions.eventId, eventId),
        eq(interactions.status, 'active'),
        isNull(interactions.parentId),
      ),
    );

  await db
    .update(interactions)
    .set({
      status: 'active',
      startedAt: new Date(),
      endedAt: null,
      currentChildId: null,
      answerRevealed: false,
    })
    .where(eq(interactions.id, quizId));

  await db
    .update(events)
    .set({ activeInteractionId: quizId, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  await publishQuiz(eventId, quizId, RealtimeEvent.QuizStarted);
}

/**
 * Puts a question on screen, leaving `fromQuestionId` (null from the lobby).
 *
 * The question opens for answers a few seconds from now. That start time is
 * stamped here, on the server, and is what scoring measures against.
 */
export async function showQuestion(
  quizId: string,
  eventId: string,
  fromQuestionId: string | null,
  questionId: string,
): Promise<boolean> {
  const opensAt = new Date(Date.now() + GET_READY_SECONDS * 1000).toISOString();

  const result = await db.execute(sql`
    with moved as (
      update interactions
         set current_child_id = ${questionId}, answer_revealed = false, updated_at = now()
       where id = ${quizId}
         and status = 'active'
         and current_child_id is not distinct from ${fromQuestionId}
      returning id
    )
    update interactions
       set started_at = ${opensAt}::timestamptz, ended_at = null
     where id = ${questionId}
       and exists (select 1 from moved)
    returning id
  `);

  if (!applied(result)) return false;

  await publishQuiz(
    eventId,
    quizId,
    fromQuestionId ? RealtimeEvent.QuizQuestionChanged : RealtimeEvent.QuizStarted,
  );
  return true;
}

/**
 * Reveals the answer to the question on screen and stamps when.
 *
 * The stamp is this server's clock, passed in, not the database's `now()`.
 * Every deadline in a run is compared against this server's clock, and the
 * two machines do not agree: stamped by the database, a reveal could appear
 * to have happened minutes ago and the quiz would skip straight past it.
 */
export async function revealAnswer(
  quizId: string,
  eventId: string,
  questionId: string,
): Promise<boolean> {
  const revealedAt = new Date().toISOString();

  const result = await db.execute(sql`
    with revealed as (
      update interactions
         set answer_revealed = true, updated_at = now()
       where id = ${quizId}
         and status = 'active'
         and current_child_id = ${questionId}
         and answer_revealed = false
      returning id
    )
    update interactions
       set ended_at = ${revealedAt}::timestamptz
     where id = ${questionId}
       and exists (select 1 from revealed)
    returning id
  `);

  if (!applied(result)) return false;

  await publishQuiz(eventId, quizId, RealtimeEvent.QuizAnswerRevealed);
  return true;
}

/**
 * Ends the run. The event keeps pointing at the quiz so the room goes on
 * seeing the final standings until the host opens something else.
 */
export async function finishQuiz(
  quizId: string,
  eventId: string,
  fromQuestionId: string | null,
): Promise<boolean> {
  const endedAt = new Date().toISOString();

  const result = await db.execute(sql`
    update interactions
       set status = 'closed', ended_at = ${endedAt}::timestamptz, current_child_id = null, answer_revealed = true
     where id = ${quizId}
       and status = 'active'
       and current_child_id is not distinct from ${fromQuestionId}
    returning id
  `);

  if (!applied(result)) return false;

  await publishQuiz(eventId, quizId, RealtimeEvent.QuizFinished);
  return true;
}

type RunState = {
  id: string;
  eventId: string;
  status: 'draft' | 'active' | 'closed';
  settings: InteractionSettings;
  currentChildId: string | null;
  answerRevealed: boolean;
  questions: {
    id: string;
    settings: InteractionSettings;
    startedAt: Date | null;
    endedAt: Date | null;
  }[];
};

/** Just enough of the quiz to decide its next step: two queries, no answers. */
async function loadRunState(quizId: string): Promise<RunState | null> {
  const [quiz] = await db
    .select({
      id: interactions.id,
      eventId: interactions.eventId,
      type: interactions.type,
      status: interactions.status,
      settings: interactions.settings,
      currentChildId: interactions.currentChildId,
      answerRevealed: interactions.answerRevealed,
    })
    .from(interactions)
    .where(eq(interactions.id, quizId))
    .limit(1);

  if (!quiz || quiz.type !== 'quiz') return null;

  const questions = await db
    .select({
      id: interactions.id,
      settings: interactions.settings,
      startedAt: interactions.startedAt,
      endedAt: interactions.endedAt,
    })
    .from(interactions)
    .where(eq(interactions.parentId, quizId))
    .orderBy(asc(interactions.position), asc(interactions.createdAt));

  return { ...quiz, questions };
}

/**
 * Takes the one step that is due on the quiz's own clock, if any.
 *
 * Screens call this when their countdown reaches zero. They only say "look
 * now": whether anything is due is decided here, against the server's time,
 * so calling early, late or a hundred times at once changes nothing.
 */
export async function advanceIfDue(quizId: string): Promise<boolean> {
  const quiz = await loadRunState(quizId);
  if (!quiz) return false;

  const index = quiz.questions.findIndex((q) => q.id === quiz.currentChildId);
  const current = quiz.questions[index] ?? null;

  const phase = quizPhase({
    status: quiz.status,
    hasCurrentQuestion: Boolean(current),
    answerRevealed: quiz.answerRevealed,
    hasScores: false,
  });

  const dueAt = nextDueAt({
    pacing: quizPacing(quiz.settings),
    phase,
    startedAt: current?.startedAt ?? null,
    revealedAt: current?.endedAt ?? null,
    timeLimitSeconds: current?.settings.timeLimitSeconds,
  });

  if (!current || dueAt === null) return false;

  // A question's answer is held back a moment past the buzzer, so an answer
  // tapped at the last instant has time to cross the network and count.
  const target = phase === 'question' ? dueAt + REVEAL_SLACK_MS : dueAt;
  const wait = target - Date.now();

  if (wait > EARLY_WINDOW_MS) return false;

  // Asked slightly early: hold the request until the moment arrives. The
  // host's screen prompts ahead of the deadline on purpose, so that loading
  // the quiz above happens while the timer is still running rather than
  // after it has reached zero, where the room would sit watching nothing.
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  // The quiz may have moved while this waited. Each step below names the
  // state it expects to leave, so a stale one simply does not apply.
  if (phase === 'question') {
    return revealAnswer(quiz.id, quiz.eventId, current.id);
  }

  const next = quiz.questions[index + 1];
  return next
    ? showQuestion(quiz.id, quiz.eventId, current.id, next.id)
    : finishQuiz(quiz.id, quiz.eventId, current.id);
}
