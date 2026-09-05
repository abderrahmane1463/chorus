import 'server-only';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { participants, questionVotes, questions } from '@/db/schema';

export type QuestionSort = 'votes' | 'newest' | 'oldest';

export const QUESTION_SORTS: QuestionSort[] = ['votes', 'newest', 'oldest'];

export type QuestionItem = {
  id: string;
  text: string;
  status: 'pending' | 'approved' | 'answered' | 'hidden' | 'archived';
  isAnonymous: boolean;
  isHighlighted: boolean;
  authorName: string | null;
  createdAt: Date;
  votes: number;
  votedByMe: boolean;
  isMine: boolean;
};

const DEFAULT_LIMIT = 200;

/**
 * Questions for one Q&A interaction.
 *
 * Author names are resolved here and blanked for anonymous questions before
 * the data leaves the server, so an anonymous asker's name is never sent to
 * the browser at all.
 */
export async function listQuestions({
  interactionId,
  participantId,
  isHost,
  sort = 'votes',
  limit = DEFAULT_LIMIT,
}: {
  interactionId: string;
  participantId: string | null;
  isHost: boolean;
  sort?: QuestionSort;
  limit?: number;
}): Promise<QuestionItem[]> {
  const voteCount = count(questionVotes.questionId);

  const orderBy =
    sort === 'newest'
      ? [desc(questions.createdAt)]
      : sort === 'oldest'
        ? [asc(questions.createdAt)]
        : [desc(voteCount), asc(questions.createdAt)];

  const rows = await db
    .select({
      id: questions.id,
      text: questions.text,
      status: questions.status,
      isAnonymous: questions.isAnonymous,
      isHighlighted: questions.isHighlighted,
      createdAt: questions.createdAt,
      participantId: questions.participantId,
      authorName: participants.displayName,
      votes: voteCount,
      votedByMe: participantId
        ? sql<boolean>`bool_or(${questionVotes.participantId} = ${participantId})`
        : sql<boolean>`false`,
    })
    .from(questions)
    .leftJoin(questionVotes, eq(questionVotes.questionId, questions.id))
    .leftJoin(participants, eq(participants.id, questions.participantId))
    .where(eq(questions.interactionId, interactionId))
    .groupBy(questions.id, participants.displayName)
    .orderBy(...orderBy)
    .limit(limit);

  return rows
    .filter((row) => {
      // Hosts see everything except what they archived away.
      if (isHost) return row.status !== 'archived';
      if (row.status === 'hidden' || row.status === 'archived') return false;
      // A pending question stays visible to its author so their submission
      // does not appear to have vanished.
      if (row.status === 'pending') return row.participantId === participantId;
      return true;
    })
    .map((row) => ({
      id: row.id,
      text: row.text,
      status: row.status,
      isAnonymous: row.isAnonymous,
      isHighlighted: row.isHighlighted,
      authorName: row.isAnonymous ? null : row.authorName,
      createdAt: row.createdAt,
      votes: Number(row.votes),
      votedByMe: Boolean(row.votedByMe),
      isMine: row.participantId !== null && row.participantId === participantId,
    }));
}

/** Counts used by the host's moderation tabs. */
export async function getQuestionCounts(interactionId: string) {
  const rows = await db
    .select({ status: questions.status, total: count() })
    .from(questions)
    .where(eq(questions.interactionId, interactionId))
    .groupBy(questions.status);

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.total]));

  return {
    pending: byStatus.pending ?? 0,
    approved: byStatus.approved ?? 0,
    answered: byStatus.answered ?? 0,
    hidden: byStatus.hidden ?? 0,
    total: rows.reduce((sum, row) => sum + row.total, 0),
  };
}

/** Top questions for the presenter screen. */
export async function getTopQuestions(interactionId: string, limit = 6) {
  const all = await listQuestions({
    interactionId,
    participantId: null,
    isHost: false,
    sort: 'votes',
    limit: 50,
  });

  const highlighted = all.filter((question) => question.isHighlighted);
  if (highlighted.length > 0) return highlighted.slice(0, limit);

  return all.filter((question) => question.status !== 'answered').slice(0, limit);
}

export async function findQuestionOwner(questionId: string) {
  const [row] = await db
    .select({
      id: questions.id,
      eventId: questions.eventId,
      interactionId: questions.interactionId,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  return row ?? null;
}

/** Resolves a participant row from the signed session, scoped to one event. */
export async function findParticipant(eventId: string, sessionId: string) {
  const [row] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(eq(participants.eventId, eventId), eq(participants.sessionId, sessionId)),
    )
    .limit(1);

  return row ?? null;
}
