import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '@/components/shared/logo';
import { JoinForm } from '@/components/participant/join-form';

export const metadata: Metadata = {
  title: 'Join an event',
  description: 'Enter your event code to join.',
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-8" aria-label="Chorus home">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Join an event</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Enter the code shown on screen. No account needed.
        </p>
        <JoinForm defaultCode={code ?? ''} />
      </div>
    </div>
  );
}
