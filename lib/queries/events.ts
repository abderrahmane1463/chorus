import 'server-only';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, interactions, participants, questions, responses } from '@/db/schema';

export type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  eventCode: string;
  status: (typeof events.status.enumValues)[number];
  activeInteractionId: string | null;
  createdAt: Date;
  participantCount: number;
  interactionCount: number;
  responseCount: number;
  questionCount: number;
};

/**
 * Loads one event, but only if the given user owns it.
 *
 * Ownership is part of the WHERE clause rather than a check afterwards, so a
 * host cannot read another host's event by guessing its id.
 */
export async function getEventForOwner(
  eventId: string,
  userId: string,
): Promise<EventDetail | null> {
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      eventCode: events.eventCode,
      status: events.status,
      activeInteractionId: events.activeInteractionId,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, userId)))
    .limit(1);

  if (!event) return null;

  // Counted separately: a single grouped query would multiply rows across joins.
  const [participantRows, interactionRows, responseRows, questionRows] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(participants)
        .where(eq(participants.eventId, eventId)),
      db
        .select({ total: count() })
        .from(interactions)
        .where(and(eq(interactions.eventId, eventId), isNull(interactions.parentId))),
      db
        .select({ total: count() })
        .from(responses)
        .innerJoin(interactions, eq(interactions.id, responses.interactionId))
        .where(eq(interactions.eventId, eventId)),
      db
        .select({ total: count() })
        .from(questions)
        .where(eq(questions.eventId, eventId)),
    ]);

  return {
    ...event,
    participantCount: participantRows[0]?.total ?? 0,
    interactionCount: interactionRows[0]?.total ?? 0,
    responseCount: responseRows[0]?.total ?? 0,
    questionCount: questionRows[0]?.total ?? 0,
  };
}

/** Confirms ownership without loading the whole row. */
export async function assertEventOwner(
  eventId: string,
  userId: string,
): Promise<{ id: string; eventCode: string } | null> {
  const [event] = await db
    .select({ id: events.id, eventCode: events.eventCode })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, userId)))
    .limit(1);

  return event ?? null;
}
