'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, interactionOptions, interactions, responses } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertEventOwner } from '@/lib/queries/events';
import { getInteractionMeta } from '@/lib/interactions/registry';
import {
  createInteractionSchema,
  interactionIdSchema,
  reorderInteractionsSchema,
  setInteractionStatusSchema,
  updateInteractionSchema,
} from '@/lib/validations/interaction';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { ActionResult } from './auth';

type OwnedInteraction = { id: string; eventId: string; type: string };

/** Resolves an interaction only if the caller owns the event it belongs to. */
async function requireOwnedInteraction(
  interactionId: string,
  userId: string,
): Promise<OwnedInteraction | null> {
  const [row] = await db
    .select({
      id: interactions.id,
      eventId: interactions.eventId,
      type: interactions.type,
    })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(and(eq(interactions.id, interactionId), eq(events.ownerId, userId)))
    .limit(1);

  return row ?? null;
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/dashboard/events/${eventId}`);
}

export async function createInteractionAction(
  input: unknown,
): Promise<ActionResult & { interactionId?: string }> {
  const user = await requireUser();

  const parsed = createInteractionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Unsupported interaction type' };

  const owned = await assertEventOwner(parsed.data.eventId, user.id);
  if (!owned) return { ok: false, error: 'Event not found' };

  const meta = getInteractionMeta(parsed.data.type);
  if (!meta) return { ok: false, error: 'Unsupported interaction type' };

  const [{ highest }] = await db
    .select({ highest: max(interactions.position) })
    .from(interactions)
    .where(
      and(eq(interactions.eventId, parsed.data.eventId), isNull(interactions.parentId)),
    );

  const [created] = await db
    .insert(interactions)
    .values({
      eventId: parsed.data.eventId,
      type: parsed.data.type,
      title: '',
      position: (highest ?? -1) + 1,
      settings: meta.defaults,
    })
    .returning({ id: interactions.id });

  // Types that need choices start with two blanks, matching the minimum.
  if (meta.hasOptions) {
    await db.insert(interactionOptions).values([
      { interactionId: created.id, text: '', position: 0 },
      { interactionId: created.id, text: '', position: 1 },
    ]);
  }

  revalidateEvent(parsed.data.eventId);
  return { ok: true, interactionId: created.id };
}

export async function updateInteractionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateInteractionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  }

  const owned = await requireOwnedInteraction(parsed.data.interactionId, user.id);
  if (!owned) return { ok: false, error: 'Interaction not found' };

  const meta = getInteractionMeta(owned.type);
  const submittedOptions = parsed.data.options ?? [];

  if (meta?.hasOptions) {
    const filled = submittedOptions.filter((option) => option.text.trim().length > 0);
    if (filled.length < 2) {
      return { ok: false, error: 'Add at least two options' };
    }
  }

  await db
    .update(interactions)
    .set({
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      settings: parsed.data.settings,
      updatedAt: new Date(),
    })
    .where(eq(interactions.id, parsed.data.interactionId));

  if (meta?.hasOptions) {
    const kept = submittedOptions.filter((option) => option.text.trim().length > 0);
    const keptIds = new Set(kept.map((option) => option.id).filter(Boolean));

    const existing = await db
      .select({ id: interactionOptions.id })
      .from(interactionOptions)
      .where(eq(interactionOptions.interactionId, parsed.data.interactionId));

    // Removing an option deletes its votes too, which is why the editor warns
    // before letting a host delete one on a poll that already has responses.
    for (const option of existing) {
      if (!keptIds.has(option.id)) {
        await db
          .delete(interactionOptions)
          .where(eq(interactionOptions.id, option.id));
      }
    }

    for (const [index, option] of kept.entries()) {
      if (option.id) {
        await db
          .update(interactionOptions)
          .set({ text: option.text.trim(), position: index })
          .where(eq(interactionOptions.id, option.id));
      } else {
        await db.insert(interactionOptions).values({
          interactionId: parsed.data.interactionId,
          text: option.text.trim(),
          position: index,
        });
      }
    }
  }

  await publish(channels.event(owned.eventId), RealtimeEvent.InteractionChanged, {
    eventId: owned.eventId,
    interactionId: owned.id,
  });

  revalidateEvent(owned.eventId);
  return { ok: true };
}

/**
 * Opens or closes an interaction.
 *
 * Only one interaction is active at a time: a presenter shows one thing, and
 * this keeps the participant view unambiguous without extra client logic.
 */
export async function setInteractionStatusAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = setInteractionStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid status' };

  const owned = await requireOwnedInteraction(parsed.data.interactionId, user.id);
  if (!owned) return { ok: false, error: 'Interaction not found' };

  if (parsed.data.status === 'active') {
    await db
      .update(interactions)
      .set({ status: 'closed', endedAt: new Date() })
      .where(
        and(eq(interactions.eventId, owned.eventId), eq(interactions.status, 'active')),
      );

    await db
      .update(interactions)
      .set({ status: 'active', startedAt: new Date(), endedAt: null })
      .where(eq(interactions.id, owned.id));

    await db
      .update(events)
      .set({ activeInteractionId: owned.id, updatedAt: new Date() })
      .where(eq(events.id, owned.eventId));
  } else {
    await db
      .update(interactions)
      .set({
        status: parsed.data.status,
        endedAt: parsed.data.status === 'closed' ? new Date() : null,
      })
      .where(eq(interactions.id, owned.id));

    await db
      .update(events)
      .set({ activeInteractionId: null, updatedAt: new Date() })
      .where(
        and(eq(events.id, owned.eventId), eq(events.activeInteractionId, owned.id)),
      );
  }

  await publish(
    channels.event(owned.eventId),
    parsed.data.status === 'active'
      ? RealtimeEvent.InteractionStarted
      : RealtimeEvent.InteractionStopped,
    { eventId: owned.eventId, interactionId: owned.id },
  );

  revalidateEvent(owned.eventId);
  return { ok: true };
}

/** Clears every response so the same question can be reused with a new room. */
export async function resetInteractionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = interactionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid interaction' };

  const owned = await requireOwnedInteraction(parsed.data.interactionId, user.id);
  if (!owned) return { ok: false, error: 'Interaction not found' };

  await db.delete(responses).where(eq(responses.interactionId, owned.id));

  await publish(channels.event(owned.eventId), RealtimeEvent.InteractionReset, {
    eventId: owned.eventId,
    interactionId: owned.id,
  });

  revalidateEvent(owned.eventId);
  return { ok: true };
}

export async function deleteInteractionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = interactionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid interaction' };

  const owned = await requireOwnedInteraction(parsed.data.interactionId, user.id);
  if (!owned) return { ok: false, error: 'Interaction not found' };

  await db.delete(interactions).where(eq(interactions.id, owned.id));

  await db
    .update(events)
    .set({ activeInteractionId: null })
    .where(
      and(eq(events.id, owned.eventId), eq(events.activeInteractionId, owned.id)),
    );

  await publish(channels.event(owned.eventId), RealtimeEvent.InteractionChanged, {
    eventId: owned.eventId,
  });

  revalidateEvent(owned.eventId);
  return { ok: true };
}

export async function reorderInteractionsAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = reorderInteractionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid order' };

  const owned = await assertEventOwner(parsed.data.eventId, user.id);
  if (!owned) return { ok: false, error: 'Event not found' };

  for (const [index, id] of parsed.data.orderedIds.entries()) {
    await db
      .update(interactions)
      .set({ position: index })
      .where(and(eq(interactions.id, id), eq(interactions.eventId, parsed.data.eventId)));
  }

  revalidateEvent(parsed.data.eventId);
  return { ok: true };
}
