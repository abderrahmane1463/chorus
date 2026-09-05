'use server';

import { AuthError } from 'next-auth';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { signIn } from '@/lib/auth';
import { hashPassword } from '@/lib/auth/password';
import { signInSchema, signUpSchema } from '@/lib/validations/auth';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Creates a host account and signs them straight in.
 *
 * `signIn` throws a redirect on success, which Next needs to propagate, so the
 * catch below deliberately rethrows anything that is not an AuthError.
 */
export async function signUpAction(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { ok: false, error: 'An account with that email already exists' };
  }

  await db.insert(users).values({
    name,
    email,
    passwordHash: await hashPassword(password),
  });

  try {
    await signIn('credentials', { email, password, redirectTo: '/dashboard' });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: 'Account created, but sign-in failed. Try signing in.' };
    }
    throw error;
  }

  return { ok: true };
}

export async function signInAction(
  input: unknown,
  callbackUrl?: string,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl || '/dashboard',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: 'That email and password do not match an account' };
    }
    throw error;
  }

  return { ok: true };
}
