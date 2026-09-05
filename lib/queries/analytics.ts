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
import { getLeaderboard, type LeaderboardRow } from './quiz';

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
  quizzes: { id: string; title: string; leaderboard: LeaderboardRow[] }[];
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
  ]);

  const perInteraction: EventAnalytics['perInteraction'] = [];
  const quizzes: EventAnalytics['quizzes'] = [];

  for (const interaction of topLevel) {
    if (interaction.type === 'quiz') {
      quizzes.push({
        id: interaction.id,
        title: interaction.title,
        leaderboard: await getLeaderboard(interaction.id),
      });
      continue;
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

      perInteraction.push({
        id: interaction.id,
        type: interaction.type,
        title: interaction.title,
        responseCount: asked?.total ?? 0,
        participantCount: asked?.people ?? 0,
        questionCount: asked?.total ?? 0,
        results: { kind: 'none', total: asked?.total ?? 0 },
      });
      continue;
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

      const childResults: NonNullable<
        EventAnalytics['perInteraction'][number]['children']
      > = [];
      let totalResponses = 0;
      const people = new Set<string>();

      for (const child of children) {
        const childOptions = await db
          .select({ id: interactionOptions.id, text: interactionOptions.text })
          .from(interactionOptions)
          .where(eq(interactionOptions.interactionId, child.id))
          .orderBy(asc(interactionOptions.position));

        const rows = await db
          .select({ participantId: responses.participantId })
          .from(responses)
          .where(eq(responses.interactionId, child.id));

        totalResponses += rows.length;
        rows.forEach((row) => people.add(row.participantId));

        childResults.push({
          id: child.id,
          title: child.title,
          results: await getInteractionResults({ ...child, options: childOptions }),
        });
      }

      perInteraction.push({
        id: interaction.id,
        type: interaction.type,
        title: interaction.title,
        responseCount: totalResponses,
        participantCount: people.size,
        results: { kind: 'none', total: totalResponses },
        children: childResults,
      });
      continue;
    }

    const options = await db
      .select({ id: interactionOptions.id, text: interactionOptions.text })
      .from(interactionOptions)
      .where(eq(interactionOptions.interactionId, interaction.id))
      .orderBy(asc(interactionOptions.position));

    const [counts] = await db
      .select({
        total: count(),
        people: countDistinct(responses.participantId),
      })
      .from(responses)
      .where(eq(responses.interactionId, interaction.id));

    perInteraction.push({
      id: interaction.id,
      type: interaction.type,
      title: interaction.title,
      responseCount: counts?.total ?? 0,
      participantCount: counts?.people ?? 0,
      results: await getInteractionResults({ ...interaction, options }),
    });
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
