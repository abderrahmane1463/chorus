'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { events, interactionOptions, interactions } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertSurveyOwner } from '@/lib/queries/survey';
import { getInteractionMeta, SURVEY_CHILD_TYPES } from '@/lib/interactions/registry';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import { interactionSettingsSchema } from '@/lib/validations/interaction';
import type { ActionResult } from './auth';

const addSurveyQuestionSchema = z.object({
  surveyId: z.string().uuid(),
  type: z.enum(SURVEY_CHILD_TYPES),
});

const saveSurveyQuestionSchema = z.object({
  questionId: z.string().uuid(),
  title: z.string().trim().min(1, 'Add a question').max(300),
  settings: interactionSettingsSchema,
  options: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        text: z.string().trim().max(160),
      }),
    )
    .max(10)
    .optional(),
});

const surveyQuestionIdSchema = z.object({ questionId: z.string().uuid() });

export async function addSurveyQuestionAction(
  input: unknown,
): Promise<ActionResult & { questionId?: string }> {
  const user = await requireUser();

  const parsed = addSurveyQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Unsupported question type' };

  const owned = await assertSurveyOwner(parsed.data.surveyId, user.id);
  if (!owned) return { ok: false, error: 'Survey not found' };

  const meta = getInteractionMeta(parsed.data.type);

  const [{ highest }] = await db
    .select({ highest: max(interactions.position) })
    .from(interactions)
    .where(eq(interactions.parentId, owned.id));

  const [created] = await db
    .insert(interactions)
    .values({
      eventId: owned.eventId,
      parentId: owned.id,
      type: parsed.data.type,
      title: '',
      position: (highest ?? -1) + 1,
      settings: meta?.defaults ?? {},
    })
    .returning({ id: interactions.id });

  if (meta?.hasOptions) {
    await db.insert(interactionOptions).values([
      { interactionId: created.id, text: '', position: 0 },
      { interactionId: created.id, text: '', position: 1 },
    ]);
  }

  revalidatePath(`/dashboard/events/${owned.eventId}`);
  return { ok: true, questionId: created.id };
}

export async function saveSurveyQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = saveSurveyQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid question' };
  }

  // Ownership runs through the child's event, same as every other interaction.
  const [question] = await db
    .select({
      id: interactions.id,
      eventId: interactions.eventId,
      parentId: interactions.parentId,
      type: interactions.type,
    })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(
      and(eq(interactions.id, parsed.data.questionId), eq(events.ownerId, user.id)),
    )
    .limit(1);

  if (!question?.parentId) return { ok: false, error: 'Question not found' };

  const meta = getInteractionMeta(question.type);
  const filled = (parsed.data.options ?? []).filter(
    (option) => option.text.trim().length > 0,
  );

  if (meta?.hasOptions && filled.length < 2) {
    return { ok: false, error: 'Add at least two options' };
  }

  await db
    .update(interactions)
    .set({
      title: parsed.data.title,
      settings: parsed.data.settings,
      updatedAt: new Date(),
    })
    .where(eq(interactions.id, question.id));

  if (meta?.hasOptions) {
    const keptIds = new Set(filled.map((option) => option.id).filter(Boolean));
    const existing = await db
      .select({ id: interactionOptions.id })
      .from(interactionOptions)
      .where(eq(interactionOptions.interactionId, question.id));

    for (const option of existing) {
      if (!keptIds.has(option.id)) {
        await db.delete(interactionOptions).where(eq(interactionOptions.id, option.id));
      }
    }

    for (const [index, option] of filled.entries()) {
      if (option.id) {
        await db
          .update(interactionOptions)
          .set({ text: option.text.trim(), position: index })
          .where(eq(interactionOptions.id, option.id));
      } else {
        await db.insert(interactionOptions).values({
          interactionId: question.id,
          text: option.text.trim(),
          position: index,
        });
      }
    }
  }

  await publish(channels.event(question.eventId), RealtimeEvent.InteractionChanged, {
    eventId: question.eventId,
    interactionId: question.parentId,
  });

  revalidatePath(`/dashboard/events/${question.eventId}`);
  return { ok: true };
}

export async function deleteSurveyQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = surveyQuestionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid question' };

  const [question] = await db
    .select({ id: interactions.id, eventId: interactions.eventId })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(
      and(eq(interactions.id, parsed.data.questionId), eq(events.ownerId, user.id)),
    )
    .limit(1);

  if (!question) return { ok: false, error: 'Question not found' };

  await db.delete(interactions).where(eq(interactions.id, question.id));
  revalidatePath(`/dashboard/events/${question.eventId}`);
  return { ok: true };
}
