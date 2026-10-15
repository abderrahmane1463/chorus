'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/shared/logo';
import { PoweredBy } from '@/components/shared/powered-by';
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
  const t = useTranslations('errorPage');

  useEffect(() => {
    console.error('[chorus] unhandled error', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t('body')}</p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {t('reference', { digest: error.digest })}
        </p>
      )}
      <Button className="mt-6" onClick={reset}>
        {t('retry')}
      </Button>
      <PoweredBy className="mt-12" />
    </div>
  );
}
