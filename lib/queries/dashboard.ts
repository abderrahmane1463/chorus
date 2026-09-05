import 'server-only';
import { and, count, countDistinct, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  events,
  interactions,
  participants,
  questions,
  responses,
} from '@/db/schema';

export type DashboardStats = {
  totalEvents: number;
  liveEvents: number;
  totalParticipants: number;
  totalResponses: number;
};

/** Headline counters for the dashboard home, scoped to one host. */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [eventRows, participantRows, responseRows] = await Promise.all([
    db
      .select({ status: events.status, total: count() })
      .from(events)
      .where(eq(events.ownerId, userId))
      .groupBy(events.status),

    db
      .select({ total: count() })
      .from(participants)
      .innerJoin(events, eq(events.id, participants.eventId))
      .where(eq(events.ownerId, userId)),

    db
      .select({ total: count() })
      .from(responses)
      .innerJoin(interactions, eq(interactions.id, responses.interactionId))
      .innerJoin(events, eq(events.id, interactions.eventId))
      .where(eq(events.ownerId, userId)),
  ]);

  return {
    totalEvents: eventRows.reduce((sum, row) => sum + row.total, 0),
    liveEvents: eventRows.find((row) => row.status === 'live')?.total ?? 0,
    totalParticipants: participantRows[0]?.total ?? 0,
    totalResponses: responseRows[0]?.total ?? 0,
  };
}

export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  eventCode: string;
  status: (typeof events.status.enumValues)[number];
  createdAt: Date;
  participantCount: number;
  interactionCount: number;
  questionCount: number;
};

/**
 * Events owned by a host, with the counts the list view shows.
 * Counts use distinct joins so the three aggregates cannot inflate each other.
 */
export async function listEventsForUser(
  userId: string,
  limit?: number,
): Promise<EventSummary[]> {
  const query = db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      eventCode: events.eventCode,
      status: events.status,
      createdAt: events.createdAt,
      participantCount: countDistinct(participants.id),
      interactionCount: countDistinct(interactions.id),
      questionCount: countDistinct(questions.id),
    })
    .from(events)
    .leftJoin(participants, eq(participants.eventId, events.id))
    .leftJoin(
      interactions,
      // Child questions of a quiz are not counted as top-level interactions.
      and(eq(interactions.eventId, events.id), isNull(interactions.parentId)),
    )
    .leftJoin(questions, eq(questions.eventId, events.id))
    .where(eq(events.ownerId, userId))
    .groupBy(events.id)
    .orderBy(desc(events.createdAt));

  const rows = limit ? await query.limit(limit) : await query;
  return rows;
}
