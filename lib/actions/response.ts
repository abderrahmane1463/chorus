'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  events,
  interactionOptions,
  interactions,
  participants,
  responses,
} from '@/db/schema';
import { readSessionId } from '@/lib/participant/session';
import { maxEntriesFor } from '@/lib/interactions/registry';
import { normalizeWord } from '@/lib/interactions/normalize';
import { submitResponseSchema } from '@/lib/validations/interaction';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { ResponseData } from '@/types/interactions';
import type { ActionResult } from './auth';

/**
 * Records one participant's answer.
 *
 * The client sends only an interaction id and a raw value. Everything that
 * decides whether the answer counts — who is answering, whether the question
 * is open, what shape the answer must be, and whether they already answered —
 * is resolved here from the database.
 */
export async function submitResponseAction(input: unknown): Promise<ActionResult> {
  const parsed = submitResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid answer' };

  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'Join the event again to answer' };

  const [context] = await db
    .select({
      interactionId: interactions.id,
      parentId: interactions.parentId,
      type: interactions.type,
      status: interactions.status,
      settings: interactions.settings,
      eventId: events.id,
      eventCode: events.eventCode,
      eventStatus: events.status,
      participantId: participants.id,
    })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .innerJoin(
      participants,
      and(
        eq(participants.eventId, events.id),
        eq(participants.sessionId, sessionId),
      ),
    )
    .where(eq(interactions.id, parsed.data.interactionId))
    .limit(1);

  // No row means the interaction does not exist, or this session never joined
  // that event. Both are "you cannot answer this".
  if (!context) return { ok: false, error: 'You are not part of this event' };
  if (context.eventStatus === 'archived') {
    return { ok: false, error: 'This event is closed' };
  }
  // Survey questions are children and are never "active" themselves; what
  // gates them is whether their parent survey is open.
  const gateStatus = context.parentId
    ? (
        await db
          .select({ status: interactions.status })
          .from(interactions)
          .where(eq(interactions.id, context.parentId))
          .limit(1)
      )[0]?.status
    : context.status;

  if (gateStatus !== 'active') {
    return { ok: false, error: 'This question is not open for answers' };
  }

  const built = await buildResponseData(context, parsed.data);
  if ('error' in built) return { ok: false, error: built.error };

  const maxEntries = maxEntriesFor(context.type, context.settings);
  const existing = await db
    .select({ id: responses.id, slot: responses.slot })
    .from(responses)
    .where(
      and(
        eq(responses.interactionId, context.interactionId),
        eq(responses.participantId, context.participantId),
      ),
    );

  if (maxEntries === 1) {
    const allowChange = context.settings.allowChangeAnswer ?? false;
    if (existing.length > 0 && !allowChange) {
      return { ok: false, error: 'You have already answered this one' };
    }

    // Slot 0 plus the unique constraint is what makes one-answer-per-person a
    // database guarantee rather than a hopeful check above.
    await db
      .insert(responses)
      .values({
        interactionId: context.interactionId,
        participantId: context.participantId,
        slot: 0,
        responseData: built.data,
      })
      .onConflictDoUpdate({
        target: [responses.interactionId, responses.participantId, responses.slot],
        set: { responseData: built.data, updatedAt: new Date() },
      });
  } else {
    if (existing.length >= maxEntries) {
      return {
        ok: false,
        error: `You can submit up to ${maxEntries} ${maxEntries === 1 ? 'answer' : 'answers'}`,
      };
    }

    const usedSlots = new Set(existing.map((row) => row.slot));
    let slot = 0;
    while (usedSlots.has(slot)) slot += 1;

    await db.insert(responses).values({
      interactionId: context.interactionId,
      participantId: context.participantId,
      slot,
      responseData: built.data,
    });
  }

  await publish(channels.event(context.eventId), RealtimeEvent.ResponseCreated, {
    eventId: context.eventId,
    interactionId: context.interactionId,
  });

  revalidatePath(`/event/${context.eventCode}`);
  revalidatePath(`/dashboard/events/${context.eventId}`);
  return { ok: true };
}

type Context = {
  interactionId: string;
  type: string;
  settings: Record<string, unknown> & {
    allowMultiple?: boolean;
    maxSelections?: number;
    scaleMin?: number;
    scaleMax?: number;
    maxLength?: number;
  };
};

/** Validates the payload against the interaction's own type and settings. */
async function buildResponseData(
  context: Context,
  input: { optionIds?: string[]; value?: number; text?: string },
): Promise<{ data: ResponseData } | { error: string }> {
  switch (context.type) {
    case 'multiple_choice': {
      const ids = input.optionIds ?? [];
      if (ids.length === 0) return { error: 'Choose an answer' };

      const limit = context.settings.allowMultiple
        ? (context.settings.maxSelections ?? 10)
        : 1;
      if (ids.length > limit) {
        return { error: `Choose at most ${limit}` };
      }

      // Option ids must belong to this interaction, or a crafted request could
      // add votes to a different poll's options.
      const valid = await db
        .select({ id: interactionOptions.id })
        .from(interactionOptions)
        .where(
          and(
            eq(interactionOptions.interactionId, context.interactionId),
            inArray(interactionOptions.id, ids),
          ),
        );

      if (valid.length !== ids.length) return { error: 'That answer is not valid' };

      return { data: { kind: 'multiple_choice', optionIds: ids } };
    }

    case 'rating': {
      const min = context.settings.scaleMin ?? 1;
      const max = context.settings.scaleMax ?? 5;
      const value = input.value;

      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { error: 'Choose a rating' };
      }
      if (value < min || value > max) return { error: 'That rating is out of range' };

      return { data: { kind: 'rating', value } };
    }

    case 'word_cloud': {
      const word = (input.text ?? '').trim().slice(0, 60);
      if (word.length === 0) return { error: 'Type a word first' };

      const normalized = normalizeWord(word);
      if (normalized.length === 0) return { error: 'Type a word first' };

      return { data: { kind: 'word_cloud', word, normalized } };
    }

    case 'ranking': {
      const ids = input.optionIds ?? [];
      if (ids.length === 0) return { error: 'Put the options in order first' };

      const options = await db
        .select({ id: interactionOptions.id })
        .from(interactionOptions)
        .where(eq(interactionOptions.interactionId, context.interactionId));

      // A ranking must be a complete permutation: every option exactly once.
      const valid = new Set(options.map((option) => option.id));
      const unique = new Set(ids);
      if (
        unique.size !== ids.length ||
        ids.length !== valid.size ||
        !ids.every((id) => valid.has(id))
      ) {
        return { error: 'Rank every option exactly once' };
      }

      return { data: { kind: 'ranking', optionIds: ids } };
    }

    case 'open_text': {
      const maxLength = context.settings.maxLength ?? 280;
      const text = (input.text ?? '').trim().slice(0, maxLength);
      if (text.length === 0) return { error: 'Write an answer first' };

      return { data: { kind: 'open_text', text } };
    }

    default:
      return { error: 'This interaction cannot be answered yet' };
  }
}
