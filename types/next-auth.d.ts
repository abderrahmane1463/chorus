import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      /** See lib/auth/stamp: which password the session was issued under. */
      stamp?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    stamp?: string | null;
  }
}

export {};
