'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowUp, Trophy } from 'lucide-react';
import type { LeaderboardRow } from '@/lib/queries/quiz';
import { cn } from '@/lib/utils/cn';

const MEDALS = ['text-amber-500', 'text-neutral-400', 'text-amber-700'];

/** Long enough to read the old order before it changes. */
const SETTLE_DELAY_MS = 900;

/**
 * Whether the board has moved from the previous standings to the current ones.
 *
 * A board that has just appeared starts in the old order and then settles, so
 * the room sees rows travel rather than being handed the final order. With
 * nothing to show, or with motion turned off, it is settled from the start.
 */
function useSettled(hasMovement: boolean, reduceMotion: boolean | null): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!hasMovement || reduceMotion) return;
    const id = setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => clearTimeout(id);
  }, [hasMovement, reduceMotion]);

  return settled || !hasMovement || Boolean(reduceMotion);
}

export function Leaderboard({
  rows,
  highlightParticipantId,
  emphasis = false,
}: {
  rows: LeaderboardRow[];
  /** Marks the viewer's own row so they can find themselves. */
  highlightParticipantId?: string;
  emphasis?: boolean;
}) {
  const t = useTranslations('leaderboard');
  const format = useFormatter();
  const reduceMotion = useReducedMotion();

  const hasMovement = rows.some(
    (row) => row.previousRank !== null && row.previousRank !== row.rank,
  );
  const settled = useSettled(hasMovement, reduceMotion);

  if (rows.length === 0) {
    return (
      <p className={cn('text-muted-foreground', emphasis ? 'text-2xl' : 'text-sm')}>
        {t('noScores')}
      </p>
    );
  }

  // Before settling, order by where everyone stood. Players new to the board
  // have no earlier place, so they wait at the bottom in their current order.
  const ordered = settled
    ? rows
    : [...rows].sort(
        (a, b) =>
          (a.previousRank ?? Number.MAX_SAFE_INTEGER) -
            (b.previousRank ?? Number.MAX_SAFE_INTEGER) || a.rank - b.rank,
      );

  return (
    <ol className="space-y-2">
      {ordered.map((row, index) => {
        const mine = row.participantId === highlightParticipantId;
        // The number on the row follows the order on screen, so it never
        // claims a place the row has not reached yet.
        const shownRank = settled ? row.rank : index + 1;
        const climbed =
          settled && row.previousRank !== null && row.previousRank > row.rank
            ? row.previousRank - row.rank
            : 0;

        return (
          <motion.li
            key={row.participantId}
            // `layout` slides a row to its new place when the order changes.
            layout={reduceMotion ? false : 'position'}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4',
              emphasis ? 'py-4 text-2xl' : 'py-2.5 text-sm',
              mine ? 'border-primary bg-primary-subtle' : 'border-border bg-card',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center font-semibold tabular-nums',
                emphasis ? 'w-12 text-3xl' : 'w-7',
              )}
            >
              {shownRank <= 3 ? (
                <Trophy
                  className={cn(emphasis ? 'size-8' : 'size-4', MEDALS[shownRank - 1])}
                  aria-label={t('rank', { rank: shownRank })}
                />
              ) : (
                format.number(shownRank)
              )}
            </span>

            <span className="min-w-0 flex-1 truncate font-medium">
              {row.displayName ?? t('anonymous')}
              {mine && (
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {t('you')}
                </span>
              )}
            </span>

            {climbed > 0 && (
              <motion.span
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className={cn(
                  'inline-flex shrink-0 items-center gap-0.5 font-medium text-success',
                  emphasis ? 'text-xl' : 'text-xs',
                )}
                aria-label={t('climbed', { count: climbed })}
              >
                <ArrowUp className={emphasis ? 'size-5' : 'size-3'} aria-hidden />
                {format.number(climbed)}
              </motion.span>
            )}

            <span className="shrink-0 text-muted-foreground">
              {t('correct', { count: row.correctAnswers })}
            </span>
            <span
              className={cn(
                'shrink-0 text-end font-semibold tabular-nums',
                emphasis ? 'w-28' : 'w-16',
              )}
            >
              {format.number(row.score)}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
