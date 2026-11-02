import { and, asc, count, eq, isNotNull } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import {
  interactionOptions,
  interactions,
  participants,
  questionVotes,
  questions,
  responses,
} from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import { csvFilename, toCsv } from '@/lib/utils/csv';
import { toXlsx } from '@/lib/utils/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exports one event as CSV.
 *
 * Three datasets are supported: `responses` (every answer, one row each) and
 * `questions` (the Q&A with vote counts) as CSV, and `contributions` as an
 * Excel workbook: every Q&A message with its status and when its author gave
 * consent, beside a sheet describing the event and its consent statement.
 * Ownership is checked before any data is read, so an export URL cannot be
 * used to read another host's event.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return new Response('Unauthorised', { status: 401 });
  }

  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  if (!event) return new Response('Not found', { status: 404 });

  const dataset = new URL(request.url).searchParams.get('dataset') ?? 'responses';

  if (dataset === 'contributions') {
    return contributionsWorkbook(event);
  }

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

/** Day and time in UTC, which Excel sorts as text and reads unambiguously. */
function stamp(date: Date | null) {
  return date ? `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC` : null;
}

type OwnedEvent = NonNullable<Awaited<ReturnType<typeof getEventForOwner>>>;

async function contributionsWorkbook(event: OwnedEvent) {
  const t = await getTranslations('export');

  const rows = await db
    .select({
      id: questions.id,
      interaction: interactions.title,
      text: questions.text,
      status: questions.status,
      isAnonymous: questions.isAnonymous,
      authorName: participants.displayName,
      consentedAt: participants.consentedAt,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(interactions, eq(interactions.id, questions.interactionId))
    .leftJoin(participants, eq(participants.id, questions.participantId))
    .where(eq(questions.eventId, event.id))
    .orderBy(asc(interactions.position), asc(questions.createdAt));

  const votes = await db
    .select({ questionId: questionVotes.questionId, total: count() })
    .from(questionVotes)
    .innerJoin(questions, eq(questions.id, questionVotes.questionId))
    .where(eq(questions.eventId, event.id))
    .groupBy(questionVotes.questionId);
  const tally = new Map(votes.map((vote) => [vote.questionId, vote.total]));

  const [consenting] = await db
    .select({ total: count() })
    .from(participants)
    .where(and(eq(participants.eventId, event.id), isNotNull(participants.consentedAt)));

  const statusLabel = {
    pending: t('statusPending'),
    approved: t('statusApproved'),
    answered: t('statusAnswered'),
    hidden: t('statusHidden'),
    archived: t('statusArchived'),
  } as const;

  const consent = event.settings?.consent;
  const shown = rows.filter((row) => row.status === 'approved' || row.status === 'answered');

  const workbook = toXlsx([
    {
      name: t('sheetContributions'),
      headers: [
        t('interaction'),
        t('message'),
        t('author'),
        t('status'),
        t('likes'),
        t('sentAt'),
        t('consentAt'),
      ],
      widths: [36, 70, 22, 14, 10, 20, 22],
      rows: rows.map((row) => [
        row.interaction,
        row.text,
        row.isAnonymous ? t('anonymous') : (row.authorName ?? t('anonymous')),
        statusLabel[row.status],
        tally.get(row.id) ?? 0,
        stamp(row.createdAt),
        stamp(row.consentedAt),
      ]),
    },
    {
      name: t('sheetEvent'),
      headers: [t('field'), t('value')],
      widths: [40, 90],
      rows: [
        [t('eventName'), event.title],
        [t('eventCode'), event.eventCode],
        [t('exportedAt'), stamp(new Date())],
        [t('contributions'), rows.length],
        [t('approved'), shown.length],
        [t('participants'), event.participantCount],
        [t('consenting'), consenting?.total ?? 0],
        [
          t('consentText'),
          consent?.enabled ? (consent.text ?? t('consentDefaultUsed')) : t('consentOff'),
        ],
        [t('note'), t('noteBody')],
      ],
    },
  ]);

  const filename = csvFilename(event.title, 'contributions').replace(/\.csv$/, '.xlsx');
  return new Response(workbook, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
