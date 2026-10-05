'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion, motionValue, useTransform, type MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { linear, settle, spring, useKeys } from './motion';
import { SCENES, type SceneName } from './timeline';

/** A clock that never moves, for parts drawn outside the film. */
const STILL = motionValue(0);

/**
 * One scene's layer. Fades in and out over its window in the timeline and
 * takes itself out of the page outside it, so idle scenes cost nothing to
 * draw.
 */
export function Scene({
  time,
  name,
  children,
}: {
  time: MotionValue<number>;
  name: SceneName;
  children: ReactNode;
}) {
  const { from, to } = SCENES[name];
  const opacity = useKeys(time, [from, from + 0.45, to - 0.45, to], [0, 1, 1, 0], linear);
  const visibility = useTransform(time, (t) => (t >= from && t <= to ? 'visible' : 'hidden'));

  return (
    <motion.div className="absolute inset-0" style={{ opacity, visibility }}>
      {children}
    </motion.div>
  );
}

/**
 * A line of type revealed from behind its own baseline, the way titles are
 * set in film. With `until`, it leaves upward at that moment.
 */
export function Line({
  time,
  at,
  until,
  className,
  children,
}: {
  time: MotionValue<number>;
  at: number;
  until?: number;
  className?: string;
  children: ReactNode;
}) {
  const y = useKeys(
    time,
    until === undefined ? [at, at + 0.85] : [at, at + 0.85, until - 0.5, until],
    until === undefined ? ['110%', '0%'] : ['110%', '0%', '0%', '-110%'],
  );

  return (
    // Bottom padding keeps descenders inside the mask.
    <span className={cn('block overflow-hidden pb-[0.14em]', className)}>
      <motion.span className="block" style={{ y }}>
        {children}
      </motion.span>
    </span>
  );
}

/**
 * The Chorus mark: four rising bars, drawn exactly as `components/shared/logo`
 * draws them, with each bar able to rise into place on its own. Given no
 * moment, it is simply there.
 */
export function Mark({
  time,
  at,
  size,
  className,
  style,
}: {
  time?: MotionValue<number>;
  /** When the bars start rising. */
  at?: number;
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      className={cn('text-primary', className)}
      style={style}
    >
      <Bar time={time} at={at} order={0} x={2} y={14} height={10} opacity={0.45} />
      <Bar time={time} at={at} order={1} x={8.75} y={9} height={15} opacity={0.7} />
      {/* The tallest bar rises last and carries the accent, as in the logo. */}
      <Bar time={time} at={at} order={3} x={15.5} y={4} height={20} accent />
      <Bar time={time} at={at} order={2} x={22.25} y={11} height={13} opacity={0.55} />
    </svg>
  );
}

function Bar({
  time,
  at,
  order,
  x,
  y,
  height,
  opacity = 1,
  accent = false,
}: {
  time?: MotionValue<number>;
  at?: number;
  order: number;
  x: number;
  y: number;
  height: number;
  opacity?: number;
  accent?: boolean;
}) {
  const start = (at ?? 0) + order * 0.16;
  // A voice joining: each bar rises from the baseline, the last one with a
  // touch of overshoot, like the moment a room starts answering.
  const keyed = useKeys(time ?? STILL, [start, start + 0.7], [0.04, 1], accent ? spring : settle);
  const scaleY = time && at !== undefined ? keyed : 1;

  return (
    <motion.rect
      x={x}
      y={y}
      width={4.5}
      height={height}
      rx={2.25}
      fill={accent ? 'var(--accent)' : 'currentColor'}
      opacity={opacity}
      style={{ scaleY, transformBox: 'fill-box', transformOrigin: '50% 100%' }}
    />
  );
}

/** A phone: the participant's screen, drawn at the size the stage needs. */
export function Phone({
  width,
  children,
  className,
}: {
  width: number;
  children: ReactNode;
  className?: string;
}) {
  const height = width * 2.05;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[2.6rem] border-[6px] border-[#1d2f36] bg-background shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]',
        className,
      )}
      style={{ width, height }}
    >
      {/* The speaker slot: just enough to read as a phone. */}
      <div className="absolute left-1/2 top-3 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[#1d2f36]" />
      <div className="absolute inset-x-0 bottom-0 top-8">{children}</div>
    </div>
  );
}

/** The room's big screen, or a projector, as a framed display. */
export function Display({
  width,
  height,
  children,
  className,
}: {
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[#24393f] bg-background shadow-[0_50px_100px_-30px_rgba(0,0,0,0.7)]',
        className,
      )}
      style={{ width, height }}
    >
      {children}
    </div>
  );
}

/** A small rounded tag, as the app draws status and codes. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-[18px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The "Live" badge from the app: a green dot and a word. */
export function LiveBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-success-subtle px-3 py-1 text-[17px] font-medium text-success',
        className,
      )}
    >
      <span className="size-2 rounded-full bg-success" />
      {label}
    </span>
  );
}
