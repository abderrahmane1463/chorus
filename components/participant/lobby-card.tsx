import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';

/**
 * What a phone shows while the room gathers: that it is in, and to watch the
 * big screen. Nothing of the question, which arrives when the host starts it.
 */
export function LobbyCard({ displayName }: { displayName: string | null }) {
  const t = useTranslations('lobby');

  return (
    <Card className="p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
        <Check className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{t('title')}</h2>
      {displayName && (
        <p dir="auto" className="mt-1 text-2xl font-semibold text-primary">
          {displayName}
        </p>
      )}
      <p className="mt-3 text-muted-foreground">{t('body')}</p>
    </Card>
  );
}
