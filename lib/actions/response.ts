'use server';

import { getTranslations } from 'next-intl/server';
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
import { take } from '@/lib/security/rate-limit';
import { acceptsAudience } from '@/lib/utils/event-status';
import { canChangeAnswer, maxEntriesFor } from '@/lib/interactions/registry';
import { inLobby } from '@/lib/interactions/lobby';
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
  const t = await getTranslations();

  const parsed = submitResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.invalidAnswer') };

  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: t('errors.rejoinToAnswer') };

  const [context] = await db
    .select({
      interactionId: interactions.id,
      parentId: interactions.parentId,
      type: interactions.type,
      status: interactions.status,
      startedAt: interactions.startedAt,
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
  if (!context) return { ok: false, error: t('errors.notPartOfEvent') };
  if (!take('actionPerPlayer', context.participantId)) {
    return { ok: false, error: t('errors.slowDown') };
  }
  if (!acceptsAudience(context.eventStatus)) {
    return { ok: false, error: t('errors.eventClosed') };
  }
  // Asked together: each is a round trip to the database, and none needs
  // another's answer. One after the other, they were most of the time a
  // participant waited for their answer to land.
  const [gate, built, existing] = await Promise.all([
    // Survey questions are children and are never "active" themselves; what
    // gates them is whether their parent survey is open, and started.
    context.parentId
      ? db
          .select({
            type: interactions.type,
            status: interactions.status,
            startedAt: interactions.startedAt,
          })
          .from(interactions)
          .where(eq(interactions.id, context.parentId))
          .limit(1)
          .then((rows) => rows[0])
      : context,
    buildResponseData(context, parsed.data),
    db
      .select({ id: responses.id, slot: responses.slot })
      .from(responses)
      .where(
        and(
          eq(responses.interactionId, context.interactionId),
          eq(responses.participantId, context.participantId),
        ),
      ),
  ]);

  if (gate?.status !== 'active') {
    return { ok: false, error: t('errors.questionClosed') };
  }
  // Still gathering the room: the question has not been shown yet.
  if (inLobby(gate)) {
    return { ok: false, error: t('errors.notStartedYet') };
  }
  if ('error' in built) return { ok: false, error: built.error };

  const maxEntries = maxEntriesFor(context.type, context.settings);

  if (maxEntries === 1) {
    const allowChange = canChangeAnswer(context.type, context.settings, {
      inSurvey: Boolean(context.parentId),
    });
    if (existing.length > 0 && !allowChange) {
      return { ok: false, error: t('errors.alreadyAnsweredOne') };
    }

    // Slot 0 plus the unique constraint is what makes one-answer-per-person a
    // database guarantee rather than a hopeful check above. Where the answer
    // may not change, a second tap racing the first keeps the first.
    const insert = db.insert(responses).values({
      interactionId: context.interactionId,
      participantId: context.participantId,
      slot: 0,
      responseData: built.data,
    });
    await (allowChange
      ? insert.onConflictDoUpdate({
          target: [responses.interactionId, responses.participantId, responses.slot],
          set: { responseData: built.data, updatedAt: new Date() },
        })
      : insert.onConflictDoNothing());
  } else {
    if (existing.length >= maxEntries) {
      return {
        ok: false,
        error: t('errors.submitUpTo', { count: maxEntries }),
      };
    }

    const usedSlots = new Set(existing.map((row) => row.slot));
    let slot = 0;
    while (usedSlots.has(slot)) slot += 1;

    // Two quick taps can pick the same free slot; the second is dropped
    // rather than failing.
    await db
      .insert(responses)
      .values({
        interactionId: context.interactionId,
        participantId: context.participantId,
        slot,
        responseData: built.data,
      })
      .onConflictDoNothing();
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
  const t = await getTranslations();

  switch (context.type) {
    case 'multiple_choice': {
      const ids = input.optionIds ?? [];
      if (ids.length === 0) return { error: t('errors.chooseAnswer') };

      const limit = context.settings.allowMultiple
        ? (context.settings.maxSelections ?? 10)
        : 1;
      if (ids.length > limit) {
        return { error: t('errors.chooseAtMost', { limit }) };
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

      if (valid.length !== ids.length) return { error: t('errors.answerNotValid') };

      return { data: { kind: 'multiple_choice', optionIds: ids } };
    }

    case 'rating': {
      const min = context.settings.scaleMin ?? 1;
      const max = context.settings.scaleMax ?? 5;
      const value = input.value;

      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { error: t('errors.chooseRating') };
      }
      if (value < min || value > max) return { error: t('errors.ratingOutOfRange') };

      return { data: { kind: 'rating', value } };
    }

    case 'word_cloud': {
      const word = (input.text ?? '').trim().slice(0, 60);
      if (word.length === 0) return { error: t('errors.typeWordFirst') };

      const normalized = normalizeWord(word);
      if (normalized.length === 0) return { error: t('errors.typeWordFirst') };

      return { data: { kind: 'word_cloud', word, normalized } };
    }

    case 'ranking': {
      const ids = input.optionIds ?? [];
      if (ids.length === 0) return { error: t('errors.orderFirst') };

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
        return { error: t('errors.rankEveryOption') };
      }

      return { data: { kind: 'ranking', optionIds: ids } };
    }

    case 'open_text': {
      const maxLength = context.settings.maxLength ?? 280;
      const text = (input.text ?? '').trim().slice(0, maxLength);
      if (text.length === 0) return { error: t('errors.writeAnswerFirst') };

      return { data: { kind: 'open_text', text } };
    }

    default:
      return { error: t('errors.notAnswerableYet') };
  }
}
