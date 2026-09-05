import NextAuth from 'next-auth';
import { redirect } from 'next/navigation';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { db, getDb } from '@/lib/db';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';
import { signInSchema } from '@/lib/validations/auth';
import { verifyPassword } from './password';
import { authConfig } from './config';

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
