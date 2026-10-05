'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { take } from '@/lib/security/rate-limit';
import { changePasswordSchema } from '@/lib/validations/auth';
import { updateProfileSchema } from '@/lib/validations/user';
import { messageKey } from '@/lib/validations/message';
import type { ActionResult } from './auth';

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t(messageKey(parsed.error, 'validation.nameTooShort')) };
  }

  await db
    .update(users)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath('/settings');
  return { ok: true };
}

/**
 * Replaces the signed-in host's password, after checking the current one.
 *
 * The current password is asked for even though the host is signed in: a
 * laptop left open at an event should not be enough to take the account.
 * Checking it counts against the same limit as signing in, so this form
 * cannot be used to guess the password either.
 *
 * Accounts made with Google have no password, and get none from here.
 */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const t = await getTranslations();
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t(messageKey(parsed.error, 'validation.passwordRequired')) };
  }

  if (!take('signInPerAccount', user.email)) {
    return { ok: false, error: t('errors.tooManyAttempts') };
  }

  const [account] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!account?.passwordHash) return { ok: false, error: t('errors.noPasswordToChange') };

  const valid = await verifyPassword(parsed.data.currentPassword, account.passwordHash);
  if (!valid) return { ok: false, error: t('errors.wrongPassword') };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { ok: true };
}
