'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
import type { LeaderboardRow } from '@/lib/queries/quiz';
import { cn } from '@/lib/utils/cn';

/**
 * Columns left to right are 2nd, 1st, 3rd: the winner stands in the middle,
 * as on a real podium. `reveal` is the order they appear in — third place
 * first, the winner last — so the room waits for the name that matters.
 */
const PLACES = [
  { rank: 2, height: 'h-40', medal: 'text-neutral-400', reveal: 1 },
  { rank: 1, height: 'h-56', medal: 'text-amber-500', reveal: 2 },
  { rank: 3, height: 'h-28', medal: 'text-amber-700', reveal: 0 },
] as const;

const STEP_SECONDS = 0.9;

export function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const t = useTranslations('leaderboard');
  const format = useFormatter();
  const reduceMotion = useReducedMotion();

  // dir="ltr" keeps second-first-third in podium order in Arabic too. It is a
  // picture of a stage, not a sentence, so it must not mirror.
  return (
    <div dir="ltr" className="flex items-end justify-center gap-4 sm:gap-6">
      {PLACES.map((place) => {
        const row = rows.find((candidate) => candidate.rank === place.rank);
        if (!row) return <div key={place.rank} className="w-40 sm:w-52" />;

        const delay = reduceMotion ? 0 : place.reveal * STEP_SECONDS;

        return (
          <div key={place.rank} className="flex w-40 flex-col items-center sm:w-52">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay + 0.35, duration: 0.4 }}
              className="mb-3 w-full text-center"
            >
              <Trophy className={cn('mx-auto size-9', place.medal)} aria-hidden />
              {/* The name follows its own script's direction inside the fixed stage. */}
              <p dir="auto" className="mt-2 truncate text-2xl font-semibold">
                {row.displayName ?? t('anonymous')}
              </p>
              <p className="text-xl tabular-nums text-muted-foreground">
                {format.number(row.score)}
              </p>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'flex w-full origin-bottom items-start justify-center rounded-t-xl pt-3 text-4xl font-semibold',
                place.height,
                place.rank === 1
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
              aria-label={t('rank', { rank: place.rank })}
            >
              {format.number(place.rank)}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
