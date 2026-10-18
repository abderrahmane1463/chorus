import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { stampMatches } from '@/lib/auth/stamp';

/**
 * Where `requireUser` sends a session whose account no longer exists.
 *
 * Redirecting such a session straight to /sign-in loops forever: the proxy
 * only checks that a session cookie is valid, sees one, and bounces the
 * browser back to /dashboard, which rejects it again. The cookie has to be
 * cleared before sign-in can render, and only a request can clear it.
 */
export async function GET() {
  const session = await auth();
  const id = session?.user?.id;

  if (id) {
    const [current] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    // A live account has nothing to clear. Checking again here means a link
    // to this route cannot be used to sign a real host out.
    if (current && stampMatches(session?.user?.stamp, current.passwordHash)) {
      redirect('/dashboard');
    }
  }

  await signOut({ redirectTo: '/sign-in' });
}
