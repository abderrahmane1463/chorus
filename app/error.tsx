'use client';

import { useEffect } from 'react';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';

/**
 * Top-level error boundary. Shows a recoverable message rather than a blank
 * screen when a server render fails — a dropped database connection, say.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[chorus] unhandled error', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        This is usually temporary. Try again, and if it keeps happening the
        event data is safe — nothing was lost.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
