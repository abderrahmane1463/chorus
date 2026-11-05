'use client';

import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { submitResponseAction } from '@/lib/actions/response';
import { cn } from '@/lib/utils/cn';
import { announceContribution } from './kiosk-session';

/**
 * A collective lighting on the phone: one large button, pressed once.
 *
 * The light shows as lit the moment it is tapped, and the phone gives a short
 * buzz where it can; a refusal puts it back and says why. Once the host
 * reveals, the phone sends the room's eyes to the big screen.
 */
export function LightPanel({
  interactionId,
  label,
  lit,
  revealed,
}: {
  interactionId: string;
  /** The host's own words for the button, or null for Chorus's. */
  label: string | null;
  /** Whether this person's light is already on. */
  lit: boolean;
  revealed: boolean;
}) {
  const t = useTranslations('light');
  const [, startTransition] = useTransition();
  const [on, turnOn] = useOptimistic(lit, () => true);

  function light() {
    if (on) return;
    navigator.vibrate?.(40);
    startTransition(async () => {
      turnOn(null);
      const result = await submitResponseAction({ interactionId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      announceContribution();
    });
  }

  if (revealed) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 py-10 text-center">
        <span aria-hidden className="light-dot size-6 rounded-full bg-primary" />
        <p className="text-2xl font-semibold text-balance">{t('lookUp')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <button
        type="button"
        onClick={light}
        disabled={on}
        aria-pressed={on}
        className={cn(
          'relative flex size-56 items-center justify-center rounded-full text-2xl font-semibold transition-[transform,background-color,box-shadow] duration-500 ease-out',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
          on
            ? 'light-on scale-100 bg-primary text-primary-foreground'
            : 'border-2 border-primary/60 bg-card text-foreground active:scale-95',
        )}
      >
        <span className="px-6 text-balance">{on ? t('lit') : (label ?? t('button'))}</span>
      </button>
      <p className="max-w-xs text-sm text-muted-foreground text-balance">
        {on ? t('litHint') : t('hint')}
      </p>
    </div>
  );
}
