import 'server-only';
import { roomVersion, shared } from '@/lib/cache/room';
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

type QuestionRow = {
  id: string;
  text: string;
  status: QuestionItem['status'];
  isAnonymous: boolean;
  isHighlighted: boolean;
  createdAt: Date;
  participantId: string | null;
  authorName: string | null;
  votes: number;
  /** Who voted, so each viewer can be told whether they did. */
  voters: string[];
};

/**
 * One Q&A's questions as everyone sees them, before deciding what a given
 * viewer may see. The same for every phone, so it can be read once and
 * shared (see `listQuestionsShared`).
 */
async function readQuestionRows(
  interactionId: string,
  sort: QuestionSort,
  limit: number,
): Promise<QuestionRow[]> {
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
      voters: sql<string | null>`string_agg(${questionVotes.participantId}::text, ',')`,
    })
    .from(questions)
    .leftJoin(questionVotes, eq(questionVotes.questionId, questions.id))
    .leftJoin(participants, eq(participants.id, questions.participantId))
    .where(eq(questions.interactionId, interactionId))
    .groupBy(questions.id, participants.displayName)
    .orderBy(...orderBy)
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    votes: Number(row.votes),
    voters: row.voters ? row.voters.split(',') : [],
  }));
}

/**
 * What one viewer may see of the questions. Author names are blanked for
 * anonymous questions here, before the data leaves the server, so an
 * anonymous asker's name is never sent to the browser at all.
 */
function forViewer(
  rows: QuestionRow[],
  { participantId, isHost }: { participantId: string | null; isHost: boolean },
): QuestionItem[] {
  return rows
    .filter((row) => {
      // Hosts see everything except what they archived away.
      if (isHost) return row.status !== 'archived';
      if (row.status === 'hidden' || row.status === 'archived') return false;
      // A pending question stays visible to its author so their submission
      // does not appear to have vanished; to nobody else.
      if (row.status === 'pending') {
        return participantId !== null && row.participantId === participantId;
      }
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
      votes: row.votes,
      votedByMe: participantId !== null && row.voters.includes(participantId),
      isMine: row.participantId !== null && row.participantId === participantId,
    }));
}

/** Questions for one Q&A interaction, as one viewer may see them. */
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
  return forViewer(await readQuestionRows(interactionId, sort, limit), { participantId, isHost });
}

/**
 * The same, for a phone: the list is read once per change in the room and
 * shared by every phone, which then picks out its own votes. In a busy Q&A
 * every vote makes every phone reload, and reading the list for each of them
 * was most of that cost.
 */
export async function listQuestionsShared({
  eventId,
  interactionId,
  participantId,
}: {
  eventId: string;
  interactionId: string;
  participantId: string;
}): Promise<QuestionItem[]> {
  const rows = await shared(`qa:${eventId}:${roomVersion(eventId)}:${interactionId}`, () =>
    readQuestionRows(interactionId, 'votes', DEFAULT_LIMIT),
  );
  return forViewer(rows, { participantId, isHost: false });
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
    limit: Math.max(limit, 50),
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
