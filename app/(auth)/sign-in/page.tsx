import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { SignInForm } from '@/components/auth/auth-form';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { Skeleton } from '@/components/ui/skeleton';
import { isGoogleEnabled } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Auth.js sends OAuth failures here as ?error=<code>. Anything unlisted gets
 * the generic line: the codes are for logs, not for hosts.
 */
const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    'That email already has a Chorus account with a password. Sign in with your password below.',
  AccessDenied: 'Google sign-in was cancelled.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // Rendered per request so the Google button reflects the server's
  // environment, not the secret-less CI build.
  await connection();
  const { callbackUrl, error } = await searchParams;
  const errorMessage = error
    ? (OAUTH_ERRORS[error] ?? "Google sign-in didn't work. Please try again.")
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Sign in to run your events.
      </p>

      {errorMessage && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {isGoogleEnabled() && (
        <GoogleSignIn label="Continue with Google" callbackUrl={callbackUrl} />
      )}

      {/* useSearchParams needs a Suspense boundary during prerendering. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
