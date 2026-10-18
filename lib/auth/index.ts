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
import { clientAddress, take } from '@/lib/security/rate-limit';
import { authConfig } from './config';
import { stampMatches, passwordStamp } from './stamp';

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
      async authorize(credentials, request) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Checked here, where every password attempt passes, and not only in
        // the sign-in form's action: Auth.js's own endpoint takes attempts
        // directly, and a limit placed only in the form would not see those.
        // Counted per account and per address, so guessing one account from
        // many places and many accounts from one place are both slowed.
        const address = clientAddress(request.headers);
        const allowed =
          take('signInPerAccount', parsed.data.email) &&
          take('signInPerAddress', address);
        if (!allowed) return null;

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
          stamp: passwordStamp(user.passwordHash),
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
 * The signed-in host, re-read from the database, or null.
 *
 * Sessions are JWTs, so a token stays valid until it expires even if the
 * account behind it is gone or its password has changed. Re-reading the user
 * means either loses access on its next request rather than at token expiry.
 */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [current] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!current || !stampMatches(session.user.stamp, current.passwordHash)) return null;

  return { id: current.id, name: current.name, email: current.email, image: current.image };
}

/** Resolves the signed-in host, or redirects to sign-in. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in');

  // A session the proxy accepts but that is no longer good must be cleared,
  // not sent to /sign-in, or the proxy redirects straight back. See the
  // reset route.
  const user = await currentUser();
  if (!user) redirect('/api/session/reset');

  return user;
}
