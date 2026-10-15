'use server';

import { randomBytes } from 'node:crypto';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { analyticsShares } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { assertEventOwner } from '@/lib/queries/events';
import { REPORT_SECTIONS } from '@/components/analytics/sections';
import type { ActionResult } from './auth';

const createSchema = z.object({
  eventId: z.string().uuid(),
  sections: z.array(z.enum(REPORT_SECTIONS)).min(1).max(REPORT_SECTIONS.length),
  days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
});

/**
 * Creates a public link to an event's report, showing only the chosen
 * sections, for a set number of days. Returns the link to copy.
 */
export async function createReportShareAction(
  input: unknown,
): Promise<ActionResult & { url?: string; expiresAt?: string }> {
  const t = await getTranslations();
  const user = await requireUser();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.pickSection') };

  const owned = await assertEventOwner(parsed.data.eventId, user.id);
  if (!owned) return { ok: false, error: t('errors.eventNotFound') };

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000);

  await db.insert(analyticsShares).values({
    eventId: owned.id,
    token,
    sections: [...new Set(parsed.data.sections)],
    expiresAt,
  });

  revalidatePath(`/dashboard/events/${owned.id}/analytics`);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return { ok: true, url: `${origin}/share/${token}`, expiresAt: expiresAt.toISOString() };
}

/** Switches off every link to an event's report at once. */
export async function disableReportSharesAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();
  const user = await requireUser();

  const parsed = z.object({ eventId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t('errors.invalidEvent') };

  const owned = await assertEventOwner(parsed.data.eventId, user.id);
  if (!owned) return { ok: false, error: t('errors.eventNotFound') };

  await db
    .update(analyticsShares)
    .set({ revokedAt: new Date() })
    .where(and(eq(analyticsShares.eventId, owned.id), isNull(analyticsShares.revokedAt)));

  revalidatePath(`/dashboard/events/${owned.id}/analytics`);
  return { ok: true };
}
