'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ThumbsUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { QuestionItem } from '@/lib/queries/questions';
import { cn } from '@/lib/utils/cn';

/** At most this many cards are laid out; older ones are off the wall anyway. */
const MAX_CARDS = 60;
/** The narrowest a column may be, and the space between columns, in pixels. */
const COLUMN_MIN = 340;
const COLUMN_GAP = 20;

/**
 * The tint of each card, taken in turn: the event's own colours, mixed into
 * the card so the text keeps its contrast on any template.
 */
const TINTS = [
  'color-mix(in oklab, var(--primary) 22%, var(--card))',
  'color-mix(in oklab, var(--accent) 22%, var(--card))',
  'color-mix(in oklab, var(--primary) 10%, var(--card))',
  'color-mix(in oklab, var(--accent) 10%, var(--card))',
];

/** A card keeps its tint as others arrive: picked from its id, not its place. */
function tintFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

/** Shorter messages are set larger, so a wall of mixed lengths still reads. */
function sizeFor(text: string) {
  if (text.length <= 60) return 'text-3xl';
  if (text.length <= 140) return 'text-2xl';
  return 'text-xl';
}

/**
 * The room's contributions as a wall of cards, newest first.
 *
 * The wall fills the screen and never scrolls: cards flow down columns, and
 * once the screen is full the oldest move off its far edge. A new card fades
 * in at the start of the wall, where the eye already is.
 */
export function WallBoard({
  title,
  questions,
  showVotes,
}: {
  title: string;
  questions: QuestionItem[];
  showVotes: boolean;
}) {
  const t = useTranslations('presenter');
  const reduceMotion = useReducedMotion();
  const wallRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [columns, setColumns] = useState(3);

  // The wall takes the height left between its top and the footer, and as
  // many whole columns as its width holds: the columns past them then fall
  // entirely beyond the edge, never half on screen.
  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const fit = () => {
      const top = wall.getBoundingClientRect().top + window.scrollY;
      const footerHeight = document.querySelector('footer')?.getBoundingClientRect().height ?? 0;
      setHeight(Math.max(200, window.innerHeight - footerHeight - top - 32));
      setColumns(Math.max(1, Math.floor((wall.clientWidth + COLUMN_GAP) / (COLUMN_MIN + COLUMN_GAP))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const cards = questions.slice(0, MAX_CARDS);

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between gap-6">
        <h2 className="text-4xl font-semibold leading-snug text-balance">{title}</h2>
        {questions.length > 0 && (
          <p className="shrink-0 text-2xl text-muted-foreground">
            {t('contributionTotal', { count: questions.length })}
          </p>
        )}
      </div>

      <div
        ref={wallRef}
        className="overflow-hidden"
        style={height ? { height } : undefined}
      >
        {cards.length === 0 ? (
          <p className="text-3xl text-muted-foreground">{t('wallEmpty')}</p>
        ) : (
          // Columns of a fixed height: overflow makes further columns past
          // the edge, which is how the oldest leave the wall.
          <div
            className="h-full [column-fill:auto]"
            style={{ columnCount: columns, columnGap: COLUMN_GAP }}
          >
            {cards.map((card) => (
              <motion.figure
                key={card.id}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="mb-5 break-inside-avoid rounded-2xl border border-border p-6"
                style={{ background: tintFor(card.id) }}
              >
                <blockquote
                  dir="auto"
                  className={cn(
                    'leading-snug whitespace-pre-line [overflow-wrap:anywhere]',
                    sizeFor(card.text),
                  )}
                >
                  {card.text}
                </blockquote>
                <figcaption className="mt-4 flex items-center justify-between gap-3 text-lg text-muted-foreground">
                  <span dir="auto" className="truncate">
                    {card.authorName ?? t('anonymous')}
                  </span>
                  {showVotes && card.votes > 0 && (
                    <span className="flex shrink-0 items-center gap-1.5 text-primary">
                      <ThumbsUp className="size-5" aria-hidden />
                      <span className="font-semibold tabular-nums">{card.votes}</span>
                    </span>
                  )}
                </figcaption>
              </motion.figure>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
