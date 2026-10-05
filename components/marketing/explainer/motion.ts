'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cubicBezier,
  useMotionValue,
  useTransform,
  type MotionValue,
} from 'framer-motion';

/**
 * The film's clock and the vocabulary every scene animates with.
 *
 * One MotionValue holds the playhead in seconds. Every moving thing in the
 * film is a function of it, computed by Framer Motion outside React's render
 * cycle, so the whole film costs no React renders while it plays. It also
 * means the film can be paused, scrubbed or looped exactly: nothing keeps
 * its own state, everything is read off the clock.
 */

/** Settles without overshoot: arrivals, reveals, things coming to rest. */
export const settle = cubicBezier(0.22, 1, 0.36, 1);
/** Symmetric, for things that travel or hand over to the next shot. */
export const glide = cubicBezier(0.65, 0, 0.35, 1);
/** A little give at the end, for a tap or a card landing. Used sparingly. */
export const spring = cubicBezier(0.34, 1.4, 0.64, 1);
/** Plain, for things that should not draw attention to their timing. */
export const linear = (t: number) => t;

type Ease = (t: number) => number;

/**
 * A value keyed to the playhead: `times` in seconds, `values` at each.
 * Holds the first and last values outside the range.
 */
export function useKeys(time: MotionValue<number>, times: number[], values: number[], ease?: Ease | Ease[]): MotionValue<number>;
export function useKeys(time: MotionValue<number>, times: number[], values: string[], ease?: Ease | Ease[]): MotionValue<string>;
export function useKeys(
  time: MotionValue<number>,
  times: number[],
  values: (number | string)[],
  ease: Ease | Ease[] = settle,
): MotionValue<number> | MotionValue<string> {
  return useTransform(time, times, values as number[], { ease, clamp: true });
}

/**
 * The common entrance: fades in and rises into place over `duration`
 * seconds from `at`, and, when `until` is given, fades back out there.
 */
export function useEnter(
  time: MotionValue<number>,
  at: number,
  { duration = 0.7, until, rise = 24, out = 0.45 }: {
    duration?: number;
    until?: number;
    rise?: number;
    out?: number;
  } = {},
) {
  const times = until === undefined ? [at, at + duration] : [at, at + duration, until - out, until];
  const opacity = useKeys(time, times, until === undefined ? [0, 1] : [0, 1, 1, 0]);
  const y = useKeys(time, times, until === undefined ? [rise, 0] : [rise, 0, 0, -rise / 2]);
  return { opacity, y };
}

/** A whole number counting from `from` to `to` between two moments. */
export function useCount(
  time: MotionValue<number>,
  from: number,
  to: number,
  start: number,
  end: number,
  format: (value: number) => string = (value) => String(value),
) {
  const raw = useKeys(time, [start, end], [from, to], glide);
  return useTransform(raw, (value) => format(Math.round(value)));
}

/**
 * The playhead, its transport, and when it may run.
 *
 * Plays only while the film is on screen and the tab is visible, so it
 * costs nothing to a visitor who has scrolled past or switched away. A
 * visitor's own pause is remembered: scrolling back does not overrule it.
 */
export function usePlayhead(
  duration: number,
  { autoplay, visible }: { autoplay: boolean; visible: boolean },
) {
  const time = useMotionValue(0);
  const [wantsToPlay, setWantsToPlay] = useState(autoplay);
  const [pageVisible, setPageVisible] = useState(true);
  const running = wantsToPlay && visible && pageVisible;

  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();

    const tick = (now: number) => {
      // A long gap (a dropped frame, a slow device) moves the film on by at
      // most a tenth of a second, so it never jumps a whole beat.
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = time.get() + delta;
      // The last shot fades to the same dark the first one opens from, so
      // the loop has no seam.
      time.set(next >= duration ? 0 : next);
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [running, duration, time]);

  const play = useCallback(() => setWantsToPlay(true), []);
  const pause = useCallback(() => setWantsToPlay(false), []);
  const seek = useCallback((seconds: number) => time.set(Math.max(0, Math.min(duration, seconds))), [duration, time]);

  return { time, playing: running, wantsToPlay, play, pause, seek };
}
