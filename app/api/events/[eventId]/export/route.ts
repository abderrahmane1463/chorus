import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  interactionOptions,
  interactions,
  participants,
  questionVotes,
  questions,
  responses,
} from '@/db/schema';
import { auth } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import { csvFilename, toCsv } from '@/lib/utils/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exports one event as CSV.
 *
 * Two datasets are supported: `responses` (every answer, one row each) and
 * `questions` (the Q&A with vote counts). Ownership is checked before any data
 * is read, so an export URL cannot be used to read another host's event.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorised', { status: 401 });
  }

  const { eventId } = await params;
  const event = await getEventForOwner(eventId, session.user.id);
  if (!event) return new Response('Not found', { status: 404 });

  const dataset = new URL(request.url).searchParams.get('dataset') ?? 'responses';

  if (dataset === 'questions') {
    const rows = await db
      .select({
        id: questions.id,
        text: questions.text,
        status: questions.status,
        isAnonymous: questions.isAnonymous,
        authorName: participants.displayName,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .leftJoin(participants, eq(participants.id, questions.participantId))
      .where(eq(questions.eventId, eventId))
      .orderBy(asc(questions.createdAt));

    const voteCounts = await db
      .select({ questionId: questionVotes.questionId })
      .from(questionVotes)
      .innerJoin(questions, eq(questions.id, questionVotes.questionId))
      .where(eq(questions.eventId, eventId));

    const tally = new Map<string, number>();
    for (const vote of voteCounts) {
      tally.set(vote.questionId, (tally.get(vote.questionId) ?? 0) + 1);
    }

    const csv = toCsv(
      ['Question', 'Author', 'Status', 'Upvotes', 'Submitted at'],
      rows.map((row) => [
        row.text,
        row.isAnonymous ? 'Anonymous' : (row.authorName ?? 'Anonymous'),
        row.status,
        tally.get(row.id) ?? 0,
        row.createdAt.toISOString(),
      ]),
    );

    return csvResponse(csv, csvFilename(event.title, 'questions'));
  }

  // Answers, joined to the interaction they belong to and who gave them.
  const rows = await db
    .select({
      interactionTitle: interactions.title,
      interactionType: interactions.type,
      participantName: participants.displayName,
      data: responses.responseData,
      createdAt: responses.createdAt,
    })
    .from(responses)
    .innerJoin(interactions, eq(interactions.id, responses.interactionId))
    .innerJoin(participants, eq(participants.id, responses.participantId))
    .where(eq(interactions.eventId, eventId))
    .orderBy(asc(responses.createdAt));

  // Option ids in the payloads are resolved to their labels.
  const options = await db
    .select({ id: interactionOptions.id, text: interactionOptions.text })
    .from(interactionOptions)
    .innerJoin(interactions, eq(interactions.id, interactionOptions.interactionId))
    .where(eq(interactions.eventId, eventId));

  const labels = new Map(options.map((option) => [option.id, option.text]));

  const csv = toCsv(
    ['Interaction', 'Type', 'Participant', 'Answer', 'Correct', 'Points', 'Answered at'],
    rows.map((row) => {
      const data = row.data;
      let answer = '';
      let correct = '';
      let points = '';

      switch (data.kind) {
        case 'multiple_choice':
        case 'ranking':
          answer = data.optionIds.map((id) => labels.get(id) ?? id).join(' | ');
          break;
        case 'rating':
          answer = String(data.value);
          break;
        case 'word_cloud':
          answer = data.word;
          break;
        case 'open_text':
          answer = data.text;
          break;
        case 'quiz':
          answer = data.optionIds.map((id) => labels.get(id) ?? id).join(' | ');
          correct = data.correct ? 'yes' : 'no';
          points = String(data.points);
          break;
      }

      return [
        row.interactionTitle,
        row.interactionType,
        row.participantName ?? 'Anonymous',
        answer,
        correct,
        points,
        row.createdAt.toISOString(),
      ];
    }),
  );

  return csvResponse(csv, csvFilename(event.title, 'responses'));
}

function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
