import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { SignInForm } from '@/components/auth/auth-form';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { Skeleton } from '@/components/ui/skeleton';
import { isGoogleEnabled } from '@/lib/auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signIn') };
}

/** Auth.js sends OAuth failures here as ?error=<code>. */
const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: 'notLinked',
  AccessDenied: 'cancelled',
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
  const t = await getTranslations('auth');

  // Anything unlisted gets the generic line: the codes are for logs, not hosts.
  const errorMessage = error ? t(OAUTH_ERRORS[error] ?? 'googleFailed') : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">{t('signInTitle')}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t('signInSubtitle')}</p>

      {errorMessage && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {isGoogleEnabled() && (
        <GoogleSignIn label={t('google')} callbackUrl={callbackUrl} />
      )}

      {/* useSearchParams needs a Suspense boundary during prerendering. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
