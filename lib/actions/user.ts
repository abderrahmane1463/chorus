'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { updateProfileSchema } from '@/lib/validations/user';
import type { ActionResult } from './auth';

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  }

  await db
    .update(users)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath('/settings');
  return { ok: true };
}
