import 'server-only';
import { and, asc, count, countDistinct, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  interactionOptions,
  interactions,
  participants,
  questionVotes,
  questions,
  responses,
} from '@/db/schema';
import { getInteractionResults, type InteractionResults } from './interactions';
import { getLeaderboard, getQuizDetail, type LeaderboardRow } from './quiz';

export type EventAnalytics = {
  totals: {
    /** Everyone who joined the room. */
    participants: number;
    /** Of those, how many submitted at least one answer. */
    responded: number;
    responses: number;
    interactions: number;
    questions: number;
    questionVotes: number;
  };
  /** Share of joiners who answered at least once, 0-100. */
  participationRate: number;
  /**
   * Who took part, and how, as an event report reads it: anyone who answered
   * a poll or a quiz, asked a question or voted on one counts as engaged.
   */
  engagement: {
    /** Did at least one of: answered, asked, voted. */
    engaged: number;
    /** Answered at least one poll, survey or quiz question. */
    pollVoters: number;
    /** All answers given, to polls, surveys and quiz questions alike. */
    pollVotes: number;
    /** Questions (polls, survey and quiz questions) that received an answer. */
    pollsAnswered: number;
    /** Asked a question or voted on one. */
    qaEngaged: number;
    qaAskers: number;
    qaVoters: number;
    anonymousQuestions: number;
    answeredQuestions: number;
    /** Distinct people who put their name on a question. */
    namedAuthors: number;
  };
  timeline: { minute: string; responses: number }[];
  perInteraction: {
    id: string;
    type: string;
    title: string;
    responseCount: number;
    participantCount: number;
    results: InteractionResults;
    /** Survey questions, whose answers live on child interactions. */
    children?: { id: string; title: string; results: InteractionResults }[];
    /** Q&A collects questions rather than responses. */
    questionCount?: number;
  }[];
  topQuestions: { id: string; text: string; votes: number; status: string }[];
  quizzes: {
    id: string;
    title: string;
    leaderboard: LeaderboardRow[];
    /** Each question as the room answered it. */
    questions: {
      id: string;
      title: string;
      answers: number;
      correct: number;
      options: { id: string; text: string; picks: number; isCorrect: boolean }[];
    }[];
  }[];
  firstResponseAt: Date | null;
  lastResponseAt: Date | null;
};

/**
 * Everything the analytics page shows for one event.
 *
 * Aggregates are counted with separate queries rather than one wide join:
 * joining participants, responses and questions together multiplies rows and
 * silently inflates every total.
 */
export async function getEventAnalytics(eventId: string): Promise<EventAnalytics> {
  const [
    participantRows,
    respondedRows,
    responseRows,
    questionRows,
    voteRows,
    timelineRows,
    boundsRows,
    topLevel,
    responderIds,
    askerRows,
    voterIds,
    answeredRows,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(participants)
      .where(eq(participants.eventId, eventId)),

    db
      .select({ total: countDistinct(responses.participantId) })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .where(eq(interactions.eventId, eventId)),

    db
      .select({ total: count() })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .where(eq(interactions.eventId, eventId)),

    db
      .select({ total: count() })
      .from(questions)
      .where(eq(questions.eventId, eventId)),

    db
      .select({ total: count() })
      .from(questionVotes)
      .innerJoin(questions, eq(questions.id, questionVotes.questionId))
      .where(eq(questions.eventId, eventId)),

    db
      .select({
        minute: sql<string>`to_char(date_trunc('minute', ${responses.createdAt}), 'YYYY-MM-DD"T"HH24:MI')`,
        total: count(),
      })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .where(eq(interactions.eventId, eventId))
      .groupBy(sql`date_trunc('minute', ${responses.createdAt})`)
      .orderBy(sql`date_trunc('minute', ${responses.createdAt})`),

    db
      .select({
        first: sql<Date | null>`min(${responses.createdAt})`,
        last: sql<Date | null>`max(${responses.createdAt})`,
      })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .where(eq(interactions.eventId, eventId)),

    db
      .select({
        id: interactions.id,
        type: interactions.type,
        title: interactions.title,
        settings: interactions.settings,
      })
      .from(interactions)
      .where(and(eq(interactions.eventId, eventId), isNull(interactions.parentId)))
      .orderBy(asc(interactions.position), asc(interactions.createdAt)),

    // Who answered anything: polls, surveys and quiz questions.
    db
      .selectDistinct({ id: responses.participantId })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .where(eq(interactions.eventId, eventId)),

    // Who asked, and how: named or anonymous, answered or not.
    db
      .select({
        participantId: questions.participantId,
        isAnonymous: questions.isAnonymous,
        status: questions.status,
      })
      .from(questions)
      .where(eq(questions.eventId, eventId)),

    db
      .selectDistinct({ id: questionVotes.participantId })
      .from(questionVotes)
      .innerJoin(questions, eq(questions.id, questionVotes.questionId))
      .where(eq(questions.eventId, eventId)),

    db
      .select({ total: countDistinct(responses.interactionId) })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .where(eq(interactions.eventId, eventId)),
  ]);

  type PerInteraction = EventAnalytics['perInteraction'][number];
  type QuizEntry = EventAnalytics['quizzes'][number];

  // Every interaction is read at the same time rather than one after another:
  // each costs a few round trips to the database, and in sequence the page
  // waited on all of them added up, longer with every interaction an event has.
  const analyse = async (
    interaction: (typeof topLevel)[number],
  ): Promise<{ quiz: QuizEntry } | { item: PerInteraction }> => {
    if (interaction.type === 'quiz') {
      const [leaderboard, detail] = await Promise.all([
        getLeaderboard(interaction.id),
        getQuizDetail(interaction.id),
      ]);
      return {
        quiz: {
          id: interaction.id,
          title: interaction.title,
          leaderboard,
          questions: (detail?.questions ?? []).map((question) => ({
            id: question.id,
            title: question.title,
            answers: question.answerCount,
            correct: question.correctCount,
            options: question.options.map((option) => ({
              id: option.id,
              text: option.text,
              picks: option.picks,
              isCorrect: option.isCorrect,
            })),
          })),
        },
      };
    }

    if (interaction.type === 'q_and_a') {
      // Q&A produces questions, not responses, so counting responses here
      // would always report zero.
      const [asked] = await db
        .select({
          total: count(),
          people: countDistinct(questions.participantId),
        })
        .from(questions)
        .where(eq(questions.interactionId, interaction.id));

      return {
        item: {
          id: interaction.id,
          type: interaction.type,
          title: interaction.title,
          responseCount: asked?.total ?? 0,
          participantCount: asked?.people ?? 0,
          questionCount: asked?.total ?? 0,
          results: { kind: 'none', total: asked?.total ?? 0 },
        },
      };
    }

    if (interaction.type === 'survey') {
      // A survey's answers hang off its child questions.
      const children = await db
        .select({
          id: interactions.id,
          type: interactions.type,
          title: interactions.title,
          settings: interactions.settings,
        })
        .from(interactions)
        .where(eq(interactions.parentId, interaction.id))
        .orderBy(asc(interactions.position));

      const read = await Promise.all(
        children.map(async (child) => {
          const [childOptions, rows] = await Promise.all([
            db
              .select({ id: interactionOptions.id, text: interactionOptions.text })
              .from(interactionOptions)
              .where(eq(interactionOptions.interactionId, child.id))
              .orderBy(asc(interactionOptions.position)),
            db
              .select({ participantId: responses.participantId })
              .from(responses)
              .where(eq(responses.interactionId, child.id)),
          ]);
          return {
            rows,
            result: {
              id: child.id,
              title: child.title,
              results: await getInteractionResults({ ...child, options: childOptions }),
            },
          };
        }),
      );

      const people = new Set<string>();
      let totalResponses = 0;
      for (const { rows } of read) {
        totalResponses += rows.length;
        rows.forEach((row) => people.add(row.participantId));
      }

      return {
        item: {
          id: interaction.id,
          type: interaction.type,
          title: interaction.title,
          responseCount: totalResponses,
          participantCount: people.size,
          results: { kind: 'none', total: totalResponses },
          children: read.map(({ result }) => result),
        },
      };
    }

    const [options, [counts]] = await Promise.all([
      db
        .select({ id: interactionOptions.id, text: interactionOptions.text })
        .from(interactionOptions)
        .where(eq(interactionOptions.interactionId, interaction.id))
        .orderBy(asc(interactionOptions.position)),
      db
        .select({
          total: count(),
          people: countDistinct(responses.participantId),
        })
        .from(responses)
        .where(eq(responses.interactionId, interaction.id)),
    ]);

    return {
      item: {
        id: interaction.id,
        type: interaction.type,
        title: interaction.title,
        responseCount: counts?.total ?? 0,
        participantCount: counts?.people ?? 0,
        results: await getInteractionResults({ ...interaction, options }),
      },
    };
  };

  // In the event's order, as they were read one by one before.
  const analysed = await Promise.all(topLevel.map(analyse));
  const perInteraction: PerInteraction[] = [];
  const quizzes: QuizEntry[] = [];
  for (const entry of analysed) {
    if ('quiz' in entry) quizzes.push(entry.quiz);
    else perInteraction.push(entry.item);
  }

  const topQuestions = await db
    .select({
      id: questions.id,
      text: questions.text,
      status: questions.status,
      votes: count(questionVotes.id),
    })
    .from(questions)
    .leftJoin(questionVotes, eq(questionVotes.questionId, questions.id))
    .where(eq(questions.eventId, eventId))
    .groupBy(questions.id)
    .orderBy(desc(count(questionVotes.id)), asc(questions.createdAt))
    .limit(10);

  const totalParticipants = participantRows[0]?.total ?? 0;
  const responded = respondedRows[0]?.total ?? 0;

  const askers = new Set(
    askerRows.flatMap((row) => (row.participantId ? [row.participantId] : [])),
  );
  const named = new Set(
    askerRows.flatMap((row) =>
      row.participantId && !row.isAnonymous ? [row.participantId] : [],
    ),
  );
  const voters = new Set(voterIds.map((row) => row.id));
  const qaEngaged = new Set([...askers, ...voters]);
  const engaged = new Set([...responderIds.map((row) => row.id), ...qaEngaged]);

  return {
    totals: {
      participants: totalParticipants,
      responded,
      responses: responseRows[0]?.total ?? 0,
      interactions: topLevel.length,
      questions: questionRows[0]?.total ?? 0,
      questionVotes: voteRows[0]?.total ?? 0,
    },
    participationRate:
      totalParticipants === 0
        ? 0
        : Math.round((responded / totalParticipants) * 100),
    engagement: {
      engaged: engaged.size,
      pollVoters: responded,
      pollVotes: responseRows[0]?.total ?? 0,
      pollsAnswered: answeredRows[0]?.total ?? 0,
      qaEngaged: qaEngaged.size,
      qaAskers: askers.size,
      qaVoters: voters.size,
      anonymousQuestions: askerRows.filter((row) => row.isAnonymous).length,
      answeredQuestions: askerRows.filter((row) => row.status === 'answered').length,
      namedAuthors: named.size,
    },
    timeline: timelineRows.map((row) => ({
      minute: row.minute,
      responses: row.total,
    })),
    perInteraction,
    topQuestions: topQuestions.map((row) => ({
      id: row.id,
      text: row.text,
      status: row.status,
      votes: Number(row.votes),
    })),
    quizzes,
    firstResponseAt: boundsRows[0]?.first ? new Date(boundsRows[0].first) : null,
    lastResponseAt: boundsRows[0]?.last ? new Date(boundsRows[0].last) : null,
  };
}
