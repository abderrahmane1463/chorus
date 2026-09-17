import type { Metadata } from 'next';
import { connection } from 'next/server';
import { SignUpForm } from '@/components/auth/auth-form';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { isGoogleEnabled } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignUpPage() {
  // Per request, for the same reason as the sign-in page.
  await connection();

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Free, and your audience never needs one.
      </p>
      {/* Google creates the account on first sign-in, so the same action serves both pages. */}
      {isGoogleEnabled() && <GoogleSignIn label="Sign up with Google" />}
      <SignUpForm />
    </div>
  );
}
