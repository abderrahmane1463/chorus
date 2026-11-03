'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Heart, UserRoundPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { nextKioskVisitorAction } from '@/lib/actions/join';

/** What a participant form announces once something it sent was accepted. */
export const CONTRIBUTED_EVENT = 'chorus:contributed';

/** Tells a kiosk, if this device is one, that the visitor has taken part. */
export function announceContribution() {
  window.dispatchEvent(new Event(CONTRIBUTED_EVENT));
}

/** How long the thanks stays before the tablet resets. */
const THANKS_MS = 4_000;
/** Untouched this long, the tablet resets: nobody reads the last visitor's page. */
const IDLE_MS = 90_000;

/**
 * The shared tablet's turn-taking, laid over the event page.
 *
 * Once a visitor has sent something, the tablet thanks them and resets for
 * the next one. It also resets when left alone, and the visitor can hand it
 * on themselves. Each reset forgets the visitor and returns to the join
 * screen, so the next one gives their own consent.
 */
export function KioskSession({
  thanks = null,
  thanksBody = null,
}: {
  /** The host's own thanks, or null for Chorus's. */
  thanks?: string | null;
  thanksBody?: string | null;
}) {
  const t = useTranslations('kiosk');
  const [thanking, setThanking] = useState(false);
  const [resetting, startReset] = useTransition();
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A full load, not a client navigation: nothing of the last visitor stays
  // in the tablet's memory for the next one to find.
  const reset = useCallback(() => {
    startReset(async () => {
      const next = await nextKioskVisitorAction();
      if (next) window.location.replace(next);
    });
  }, []);

  useEffect(() => {
    const restartIdle = () => {
      clearTimeout(idle.current);
      idle.current = setTimeout(reset, IDLE_MS);
    };
    const onContributed = () => {
      setThanking(true);
      clearTimeout(idle.current);
      idle.current = setTimeout(reset, THANKS_MS);
    };

    restartIdle();
    window.addEventListener(CONTRIBUTED_EVENT, onContributed);
    window.addEventListener('pointerdown', restartIdle);
    window.addEventListener('keydown', restartIdle);
    return () => {
      clearTimeout(idle.current);
      window.removeEventListener(CONTRIBUTED_EVENT, onContributed);
      window.removeEventListener('pointerdown', restartIdle);
      window.removeEventListener('keydown', restartIdle);
    };
  }, [reset]);

  if (thanking) {
    return (
      <div
        role="status"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-6 text-center"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-success-subtle text-success">
          <Heart className="size-8" aria-hidden />
        </span>
        <p dir="auto" className="text-3xl font-semibold text-balance">
          {thanks ?? t('thanks')}
        </p>
        <p dir="auto" className="text-lg text-muted-foreground text-balance">
          {thanksBody ?? t('thanksBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <Button variant="secondary" size="lg" onClick={reset} loading={resetting} className="shadow-lg">
        <UserRoundPlus aria-hidden />
        {t('next')}
      </Button>
    </div>
  );
}
