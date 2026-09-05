'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertEventOwner } from '@/lib/queries/events';
import { generateEventCode } from '@/lib/utils/event-code';
import {
  createEventSchema,
  eventIdSchema,
  updateEventSchema,
  updateEventStatusSchema,
} from '@/lib/validations/event';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { ActionResult } from './auth';

const MAX_CODE_ATTEMPTS = 10;

/**
 * Creates an event and allocates a unique join code.
 *
 * Codes are random, so collisions are possible. Rather than checking first and
 * racing another request, this relies on the unique constraint and retries.
 */
export async function createEventAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  }

  const description = parsed.data.description?.trim() || null;
  let eventId: string | null = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const [created] = await db
        .insert(events)
        .values({
          ownerId: user.id,
          title: parsed.data.title,
          description,
          eventCode: generateEventCode(),
        })
        .returning({ id: events.id });

      eventId = created.id;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('events_event_code_unique')) throw error;
    }
  }

  if (!eventId) {
    return { ok: false, error: 'Could not allocate a free event code. Try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/events');
  redirect(`/dashboard/events/${eventId}`);
}

export async function updateEventAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  }

  const owned = await assertEventOwner(parsed.data.eventId, user.id);
  if (!owned) return { ok: false, error: 'Event not found' };

  await db
    .update(events)
    .set({
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, parsed.data.eventId));

  revalidatePath(`/dashboard/events/${parsed.data.eventId}`);
  revalidatePath('/dashboard/events');
  return { ok: true };
}

export async function updateEventStatusAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateEventStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid status' };
  }

  const owned = await assertEventOwner(parsed.data.eventId, user.id);
  if (!owned) return { ok: false, error: 'Event not found' };

  await db
    .update(events)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(events.id, parsed.data.eventId));

  // Participants are watching this event; tell them the room changed.
  await publish(
    channels.event(parsed.data.eventId),
    RealtimeEvent.InteractionChanged,
    { eventId: parsed.data.eventId },
  );

  revalidatePath(`/dashboard/events/${parsed.data.eventId}`);
  revalidatePath('/dashboard/events');
  revalidatePath('/dashboard');
  return { ok: true };
}

/** Regenerates the join code, which invalidates any code already on a screen. */
export async function regenerateEventCodeAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = eventIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid event' };

  const owned = await assertEventOwner(parsed.data.eventId, user.id);
  if (!owned) return { ok: false, error: 'Event not found' };

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      await db
        .update(events)
        .set({ eventCode: generateEventCode(), updatedAt: new Date() })
        .where(eq(events.id, parsed.data.eventId));

      revalidatePath(`/dashboard/events/${parsed.data.eventId}`);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('events_event_code_unique')) throw error;
    }
  }

  return { ok: false, error: 'Could not allocate a free event code. Try again.' };
}

export async function deleteEventAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = eventIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid event' };

  // Ownership is enforced in the delete itself, not just checked beforehand.
  const deleted = await db
    .delete(events)
    .where(and(eq(events.id, parsed.data.eventId), eq(events.ownerId, user.id)))
    .returning({ id: events.id });

  if (deleted.length === 0) return { ok: false, error: 'Event not found' };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/events');
  redirect('/dashboard/events');
}
