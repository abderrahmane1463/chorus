import NextAuth from 'next-auth';
import { redirect } from 'next/navigation';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { db, getDb } from '@/lib/db';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';
import { signInSchema } from '@/lib/validations/auth';
import { verifyPassword } from './password';
import { authConfig } from './config';

/**
 * Google sign-in switches on once both credentials are configured, so the app
 * still runs — with email and password only — on a host that has not set them.
 *
 * Read per request, never at build time: CI builds without secrets, and a
 * value captured then would hide the button forever.
 */
export function isGoogleEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

/**
 * The config is a function, not an object.
 *
 * Auth.js evaluates it per request, which keeps the Drizzle adapter — and the
 * database connection it needs — out of module evaluation. Building on a host
 * without DATABASE_URL (Vercel collecting page data) would otherwise fail.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        // Accounts created through OAuth have no password hash to compare.
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    // No allowDangerousEmailAccountLinking. Password sign-up does not verify
    // email ownership, so linking by address would let someone register a
    // victim's Gmail with a password first and share their account once the
    // real owner signs in with Google. Auth.js refuses the link instead, and
    // the sign-in page explains what to do.
    ...(isGoogleEnabled() ? [Google] : []),
  ],
}));

/**
 * Resolves the signed-in host, or redirects to sign-in.
 *
 * Sessions are JWTs, so a token stays valid until it expires even if the
 * account behind it is gone. This re-reads the user, which means a deleted
 * account loses access on its next request rather than at token expiry.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in');

  const [current] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!current) redirect('/sign-in');

  return current;
}
