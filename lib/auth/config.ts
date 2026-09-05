import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe auth configuration: no database imports, so it can run inside
 * middleware. The full config in `lib/auth/index.ts` extends this.
 */
export const authConfig = {
  pages: {
    signIn: '/sign-in',
    newUser: '/dashboard',
  },
  session: {
    // Credentials sign-in requires JWT sessions; the Drizzle adapter is still
    // wired up so OAuth providers can be added without a migration.
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
