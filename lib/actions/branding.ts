'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { eventAssets, events } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertEventOwner } from '@/lib/queries/events';
import { saveBrandingSchema } from '@/lib/validations/branding';
import { publish } from '@/lib/realtime/server';
import { channels, RealtimeEvent } from '@/lib/realtime/events';
import type { EventBranding } from '@/types/branding';
import type { ActionResult } from './auth';

/**
 * Saves how an event looks.
 *
 * Every image named must be one uploaded for this event: an id is only a
 * reference, and without this check a host could borrow another event's
 * images by guessing at theirs. Images no longer used are deleted here, so
 * replacing a logo does not leave the old one behind.
 */
export async function saveBrandingAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();
  const user = await requireUser();

  const parsed = saveBrandingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.invalidDesign') };

  const { eventId, ...design } = parsed.data;

  const owned = await assertEventOwner(eventId, user.id);
  if (!owned) return { ok: false, error: t('errors.eventNotFound') };

  const used = [
    ...new Set(
      [design.logoId, design.backgroundId, ...design.partnerIds].filter(
        (id): id is string => id !== null,
      ),
    ),
  ];

  if (used.length > 0) {
    const found = await db
      .select({ id: eventAssets.id })
      .from(eventAssets)
      .where(and(eq(eventAssets.eventId, eventId), inArray(eventAssets.id, used)));

    if (found.length !== used.length) {
      return { ok: false, error: t('errors.imageMissing') };
    }
  }

  const branding: EventBranding = {
    template: design.template,
    accent: design.accent?.toLowerCase() ?? null,
    logoId: design.logoId,
    partnerIds: design.partnerIds,
    backgroundId: design.backgroundId,
    logoPlate: design.logoPlate,
    partnerPlate: design.partnerPlate,
  };

  await db
    .update(events)
    .set({ branding, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  await db
    .delete(eventAssets)
    .where(
      used.length > 0
        ? and(eq(eventAssets.eventId, eventId), notInArray(eventAssets.id, used))
        : eq(eventAssets.eventId, eventId),
    );

  // Screens already open in the room pick up the new look.
  await publish(channels.event(eventId), RealtimeEvent.InteractionChanged, { eventId });

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}/design`);
  revalidatePath(`/event/${owned.eventCode}`);
  return { ok: true };
}
