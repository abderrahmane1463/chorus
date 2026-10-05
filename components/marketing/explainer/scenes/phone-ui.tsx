'use client';

import type { ReactNode } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import { Check, Hourglass, Timer, Users } from 'lucide-react';
import { TileLetter, tileFor } from '@/components/quiz/answer-tiles';
import { cn } from '@/lib/utils/cn';
import { linear, settle, spring, useCount, useKeys } from '../motion';
import { LiveBadge, Mark } from '../parts';

/**
 * The participant's phone, screen by screen, as the app draws it: the join
 * form, the lobby, a timed question on lettered tiles, "Answer sent", and
 * the points and place after the reveal. Drawn at one size (330 wide) and
 * scaled by each scene, so it is the same phone everywhere in the film.
 */
export const PHONE_WIDTH = 330;

export const ANSWERS = ['answerA', 'answerB', 'answerC', 'answerD'] as const;

/** Shows a screen for its window, arriving from slightly below. */
export function PhoneScreen({
  time,
  from,
  to,
  children,
  className,
}: {
  time: MotionValue<number>;
  from: number;
  to?: number;
  children: ReactNode;
  className?: string;
}) {
  const times = to === undefined ? [from, from + 0.35] : [from, from + 0.35, to - 0.25, to];
  const opacity = useKeys(time, times, to === undefined ? [0, 1] : [0, 1, 1, 0], linear);
  const y = useKeys(time, times, to === undefined ? [14, 0] : [14, 0, 0, -10], settle);

  return (
    <motion.div className={cn('absolute inset-0 px-5 pb-6 pt-3', className)} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

/** The event's own strip at the top of every screen after joining. */
export function EventHeader() {
  const t = useTranslations('explainer');
  const tStatus = useTranslations('status');
  return (
    <div className="mb-5 flex items-center gap-2.5 border-b border-border pb-3">
      <Mark size={26} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{t('eventTitle')}</p>
        <p dir="ltr" className="font-mono text-[11px] text-muted-foreground">
          BRAVO-42
        </p>
      </div>
      <LiveBadge label={tStatus('live')} className="px-2 py-0.5 text-[11px]" />
    </div>
  );
}

/** Typing into the join form, then pressing Join. */
export function JoinScreen({ time, at }: { time: MotionValue<number>; at: number }) {
  const t = useTranslations('join');
  const code = useTypewriter(time, 'BRAVO-42', at + 0.4, at + 1.3);
  const name = useTypewriter(time, 'Sara', at + 1.4, at + 1.8);
  const press = useKeys(time, [at + 1.95, at + 2.05, at + 2.25], [1, 0.95, 1], [linear, spring]);
  const caretCode = useCaret(time, at + 0.2, at + 1.35);
  const caretName = useCaret(time, at + 1.35, at + 1.9);

  return (
    <div className="pt-4">
      <h3 className="text-[24px] font-semibold">{t('title')}</h3>
      <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{t('subtitle')}</p>

      <p className="mb-1.5 mt-6 text-[14px] font-medium">{t('code')}</p>
      <div
        dir="ltr"
        className="flex h-[52px] items-center justify-center rounded-lg border border-primary bg-background font-mono text-[22px] tracking-[0.18em]"
      >
        <motion.span>{code}</motion.span>
        <motion.span className="ms-0.5 h-6 w-[2px] bg-primary" style={{ opacity: caretCode }} />
      </div>

      <p className="mb-1.5 mt-5 text-[14px] font-medium">{t('name')}</p>
      <div className="flex h-[48px] items-center rounded-lg border border-input bg-background px-3.5 text-[16px]">
        <motion.span>{name}</motion.span>
        <motion.span className="ms-0.5 h-5 w-[2px] bg-primary" style={{ opacity: caretName }} />
      </div>

      <motion.div
        className="mt-6 flex h-[50px] items-center justify-center rounded-lg bg-primary text-[16px] font-medium text-primary-foreground"
        style={{ scale: press }}
      >
        {t('submit')}
      </motion.div>
    </div>
  );
}

/** Joined: the lobby, waiting for the host to start. */
export function LobbyScreen() {
  const t = useTranslations('quiz');
  return (
    <>
      <EventHeader />
      <div className="mt-16 rounded-2xl border border-border bg-card p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <Check className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-[20px] font-semibold">{t('lobbyTitle')}</p>
        <p className="mt-1 text-[28px] font-semibold text-primary">Sara</p>
        <p className="mt-5 inline-flex items-center gap-2 text-[14px] text-muted-foreground">
          <Users className="size-4" aria-hidden />
          {t('playersIn', { count: 48 })}
        </p>
      </div>
    </>
  );
}

/**
 * A timed question: the countdown draining, four lettered tiles, and the
 * player's tap on `pick` at `tapAt`.
 */
export function QuestionScreen({
  time,
  openAt,
  tapAt,
  pick = 0,
  number = 2,
}: {
  time: MotionValue<number>;
  openAt: number;
  tapAt?: number;
  pick?: number;
  number?: number;
}) {
  const t = useTranslations('explainer');
  const tp = useTranslations('presenter');
  const remaining = useTransform(time, (now) => {
    const left = Math.ceil(20 - Math.max(0, now - openAt) * 2.2);
    return `${Math.max(1, Math.min(20, left))}s`;
  });
  const drain = useKeys(time, [openAt, openAt + 8], [1, 0.12], linear);

  return (
    <>
      <EventHeader />
      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <span>{tp('questionOf', { current: number, total: 5 })}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-semibold text-foreground">
          <Timer className="size-3.5" aria-hidden />
          <motion.span className="tabular-nums">{remaining}</motion.span>
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full origin-left rounded-full bg-primary rtl:origin-right" style={{ scaleX: drain }} />
      </div>
      <p className="mt-5 text-[21px] font-semibold leading-snug">{t('question')}</p>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {ANSWERS.map((key, index) => (
          <Tile key={key} time={time} index={index} label={t(key)} tapAt={index === pick ? tapAt : undefined} />
        ))}
      </div>
    </>
  );
}

function Tile({
  time,
  index,
  label,
  tapAt,
}: {
  time: MotionValue<number>;
  index: number;
  label: string;
  tapAt?: number;
}) {
  const at = tapAt ?? Number.POSITIVE_INFINITY;
  const scale = useKeys(time, [at, at + 0.1, at + 0.4], [1, 0.93, 1], [linear, spring]);
  const ring = useKeys(time, [at, at + 0.15], [0, 1], linear);

  return (
    <motion.div
      className={cn(
        'relative flex min-h-[112px] flex-col justify-between rounded-2xl p-3 text-white',
        tileFor(index).surface,
      )}
      style={{ scale: tapAt === undefined ? 1 : scale }}
    >
      <TileLetter index={index} />
      <span className="text-[15px] font-medium leading-tight">{label}</span>
      {tapAt !== undefined && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-white/80"
          style={{ opacity: ring }}
        />
      )}
    </motion.div>
  );
}

/** After the tap: the answer is in, waiting for the reveal. */
export function SentScreen({ pick = 0 }: { pick?: number }) {
  const t = useTranslations('explainer');
  const tq = useTranslations('quiz');
  return (
    <>
      <EventHeader />
      <div className="mt-14 rounded-2xl border border-border bg-card p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <Hourglass className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-[20px] font-semibold">{tq('answerSent')}</p>
        <AnswerChip index={pick} label={t(ANSWERS[pick])} className="mt-5" />
      </div>
    </>
  );
}

/** The reveal on the phone: the points counting up, the place, the right answer. */
export function ResultScreen({
  time,
  at,
  points,
  total,
  rank,
}: {
  time: MotionValue<number>;
  at: number;
  points: number;
  total: number;
  rank: number;
}) {
  const t = useTranslations('explainer');
  const tq = useTranslations('quiz');
  const format = useFormatter();
  const counted = useCount(time, 0, points, at, at + 0.8, (value) => t('points', { points: value }));
  const burst = useKeys(time, [at, at + 0.5], [0.85, 1], spring);
  const standing = useKeys(time, [at + 0.7, at + 1.1], [0, 1], linear);
  const answer = useKeys(time, [at + 1.0, at + 1.4], [0, 1], linear);

  return (
    <>
      <EventHeader />
      <motion.div
        className="mt-6 rounded-2xl bg-success-subtle px-4 py-6 text-center"
        style={{ scale: burst }}
      >
        <motion.p className="text-[52px] font-bold leading-none tabular-nums text-success">{counted}</motion.p>
        <p className="mt-2 text-[14px] font-medium text-success">{t('pointsLabel')}</p>
      </motion.div>
      <motion.p className="mt-5 text-center text-[17px] font-medium" style={{ opacity: standing }}>
        {tq('yourRank', { rank, total: 48 })}
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-muted-foreground">{tq('totalPoints', { points: format.number(total) })}</span>
      </motion.p>
      <motion.div className="mt-5 rounded-2xl border border-border bg-card p-4" style={{ opacity: answer }}>
        <p className="text-[13px] text-muted-foreground">{tq('correctAnswers', { count: 1 })}</p>
        <AnswerChip index={0} label={t('answerA')} className="mt-2.5" />
      </motion.div>
    </>
  );
}

function AnswerChip({ index, label, className }: { index: number; label: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[15px] font-medium text-white',
        tileFor(index).surface,
        className,
      )}
    >
      <TileLetter index={index} className="size-8 text-base" />
      {label}
    </div>
  );
}

/** Text appearing a character at a time between two moments. */
function useTypewriter(time: MotionValue<number>, text: string, start: number, end: number) {
  return useTransform(time, (now) => {
    const share = Math.max(0, Math.min(1, (now - start) / (end - start)));
    return text.slice(0, Math.round(share * text.length));
  });
}

/** A blinking caret, only while that field is being typed in. */
function useCaret(time: MotionValue<number>, from: number, to: number) {
  return useTransform(time, (now) => (now >= from && now <= to && Math.floor(now * 2.4) % 2 === 0 ? 1 : 0));
}
