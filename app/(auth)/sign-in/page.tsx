import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Sign in to run your events.
      </p>
      {/* useSearchParams needs a Suspense boundary during prerendering. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
