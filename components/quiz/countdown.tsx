'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';

const URGENT_SECONDS = 5;

export type Countdown = {
  /** Whole seconds left on the question. */
  remaining: number;
  /** Add to `Date.now()` to get the server's time. */
  offsetMs: number;
};

/**
 * Seconds left on a question, measured on the server's clock.
 *
 * The question's start is stamped by the server and answers are timed there,
 * so the countdown has to agree with that clock, not the device's. A phone
 * whose clock is a minute out would otherwise show a minute too much or too
 * little. `serverNow` is the server's time when it rendered this page; the
 * difference from the device's clock is the correction.
 *
 * Nothing is returned until the first tick, so the server render and the
 * first client paint match.
 */
export function useCountdown(
  startedAt: Date | string | null | undefined,
  limitSeconds: number,
  serverNow: number,
): Countdown | null {
  const [tick, setTick] = useState<{ now: number; offsetMs: number } | null>(null);
  const bestOffset = useRef<number | null>(null);

  useEffect(() => {
    if (!startedAt) return;

    // The page took time to arrive, so every sample reads slightly too low.
    // The highest one seen is therefore the closest to the truth, and keeping
    // it stops the timer jumping each time the page refreshes.
    const sample = serverNow - Date.now();
    const offsetMs =
      bestOffset.current === null ? sample : Math.max(bestOffset.current, sample);
    bestOffset.current = offsetMs;

    const update = () => setTick({ now: Date.now() + offsetMs, offsetMs });
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [startedAt, serverNow]);

  if (!startedAt || tick === null) return null;

  const deadline = new Date(startedAt).getTime() + limitSeconds * 1000;
  return {
    remaining: Math.max(0, Math.ceil((deadline - tick.now) / 1000)),
    offsetMs: tick.offsetMs,
  };
}

/**
 * How far into the question the viewer already is, in seconds.
 *
 * Read once, when the timer mounts: CSS takes it from there. A negative
 * animation-delay of this much starts the drain at the right point.
 */
function useElapsedAtMount(startedAt: Date | string, offsetMs: number): number {
  const [elapsed] = useState(() =>
    Math.max(0, (Date.now() + offsetMs - new Date(startedAt).getTime()) / 1000),
  );
  return elapsed;
}

type TimerProps = {
  startedAt: Date | string;
  limitSeconds: number;
  countdown: Countdown;
  className?: string;
};

/** The projector's timer: a ring that drains around the seconds left. */
export function CountdownRing({ startedAt, limitSeconds, countdown, className }: TimerProps) {
  const elapsed = useElapsedAtMount(startedAt, countdown.offsetMs);
  const { remaining } = countdown;
  const urgent = remaining <= URGENT_SECONDS;

  const radius = 45;
  const length = 2 * Math.PI * radius;

  return (
    <div
      className={cn(
        'relative size-28 shrink-0',
        urgent && remaining > 0 && 'countdown-urgent',
        className,
      )}
      role="timer"
      aria-live="off"
    >
      {/* Turned so the ring empties from the top, like a clock. */}
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={length}
          className={cn(
            'countdown-ring transition-[stroke] duration-300',
            urgent ? 'stroke-destructive' : 'stroke-primary',
          )}
          style={
            {
              '--countdown-length': `${length}px`,
              animationDuration: `${limitSeconds}s`,
              animationDelay: `-${elapsed}s`,
            } as CSSProperties
          }
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-4xl font-semibold tabular-nums',
          urgent ? 'text-destructive' : 'text-foreground',
        )}
      >
        {remaining}
      </span>
    </div>
  );
}

/**
 * The phone's timer: a thin bar. Deliberately quieter than the ring, because
 * the participant is trying to read and tap, not watch a clock.
 */
export function CountdownBar({ startedAt, limitSeconds, countdown, className }: TimerProps) {
  const elapsed = useElapsedAtMount(startedAt, countdown.offsetMs);
  const urgent = countdown.remaining <= URGENT_SECONDS;

  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}
      aria-hidden
    >
      <div
        className={cn(
          // Shrinks toward the reading-start edge in either direction.
          'countdown-bar h-full rounded-full transition-colors duration-300 ltr:origin-left rtl:origin-right',
          urgent ? 'bg-destructive' : 'bg-primary',
        )}
        style={{
          animationDuration: `${limitSeconds}s`,
          animationDelay: `-${elapsed}s`,
        }}
      />
    </div>
  );
}
