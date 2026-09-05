import type { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignUpPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Free, and your audience never needs one.
      </p>
      <SignUpForm />
    </div>
  );
}
