'use client';

import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

/** The space between two items, matching `space-y-5`. */
const GAP = 20;
/** How far a swipe must travel to turn the page. */
const SWIPE_PX = 60;
/**
 * Beyond this many pages the dots give way to the count alone: a busy Q&A
 * runs to dozens of pages, and a dot for each was wider than the screen.
 */
const MAX_DOTS = 10;

/**
 * A list for the big screen that never scrolls.
 *
 * As many items as fit the screen are shown at once. When there are more, the
 * host turns the pages: by swiping across the list, with the arrows beside
 * the page dots, or by picking a dot. Nothing turns by itself, so the host
 * decides how long the room reads each page. Pages are cut from each item's
 * real height, so a long one that wraps never pushes the last off the bottom.
 */
export function PagedList<T>({
  items,
  keyOf,
  render,
}: {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
}) {
  const t = useTranslations('presenter');
  const reduceMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState<T[][]>([items]);
  const [page, setPage] = useState(0);
  /** Where a swipe began, while one is under way. */
  const swipeFrom = useRef<number | null>(null);

  // Cut the items into pages that fit the space left for the list.
  useLayoutEffect(() => {
    const list = listRef.current;
    const measure = measureRef.current;
    if (!list || !measure) return;

    const paginate = () => {
      // The space between the list's top and where the footer sits on a
      // screen-high page, less the main area's bottom padding and the page
      // dots. Measured from the window, not the footer's current place: the
      // footer moves down whenever the list is too long, which is the very
      // thing being prevented.
      const top = list.getBoundingClientRect().top + window.scrollY;
      const footerHeight = document.querySelector('footer')?.getBoundingClientRect().height ?? 0;
      const available = Math.max(160, window.innerHeight - footerHeight - top - 32 - 64);
      const heights = [...measure.children].map((row) => row.getBoundingClientRect().height);

      const next: T[][] = [];
      let current: T[] = [];
      let used = 0;
      items.forEach((item, index) => {
        const height = heights[index] ?? 0;
        if (current.length > 0 && used + GAP + height > available) {
          next.push(current);
          current = [];
          used = 0;
        }
        used += (current.length > 0 ? GAP : 0) + height;
        current.push(item);
      });
      if (current.length > 0) next.push(current);

      setPages(next.length > 0 ? next : [[]]);
    };

    paginate();
    window.addEventListener('resize', paginate);
    return () => window.removeEventListener('resize', paginate);
  }, [items]);

  // A page that no longer exists, after items were removed.
  const shown = Math.min(page, pages.length - 1);
  const go = (to: number) => setPage(Math.max(0, Math.min(pages.length - 1, to)));

  // Swiping the content the way it reads: towards the start brings the next
  // page, which in a right-to-left language is a swipe to the right.
  const endSwipe = (x: number) => {
    if (swipeFrom.current === null) return;
    const travelled = x - swipeFrom.current;
    swipeFrom.current = null;
    if (Math.abs(travelled) < SWIPE_PX) return;
    const rtl = getComputedStyle(listRef.current ?? document.body).direction === 'rtl';
    const forward = rtl ? travelled > 0 : travelled < 0;
    go(shown + (forward ? 1 : -1));
  };

  const rows = (list: T[]) => list.map((item) => <li key={keyOf(item)}>{render(item)}</li>);

  return (
    <div
      ref={listRef}
      className={cn('relative', pages.length > 1 && 'cursor-grab touch-pan-y select-none')}
      onPointerDown={(event) => {
        if (pages.length > 1) swipeFrom.current = event.clientX;
      }}
      onPointerUp={(event) => endSwipe(event.clientX)}
      onPointerCancel={() => {
        swipeFrom.current = null;
      }}
    >
      {/* Every item laid out unseen at full width, to learn its height.
          Clipped to nothing, so it never lengthens the page. */}
      <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <ul ref={measureRef}>{rows(items)}</ul>
      </div>

      {/* The new page replaces the old at once and fades in. Nothing waits
          on the old one leaving, so the page shown is always the page chosen. */}
      <motion.ul
        key={shown}
        className="space-y-5"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {rows(pages[shown] ?? [])}
      </motion.ul>

      {pages.length > 1 && (
        <nav className="mt-6 flex items-center gap-3" aria-label={t('pageOf', { page: shown + 1, total: pages.length })}>
          <button
            type="button"
            onClick={() => go(shown - 1)}
            disabled={shown === 0}
            className="rounded-full border border-border p-2.5 text-foreground transition-colors hover:bg-muted disabled:opacity-30"
            aria-label={t('previousPage')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden />
          </button>
          {pages.length <= MAX_DOTS && pages.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => go(index)}
              className="flex h-8 items-center"
              aria-label={t('pageOf', { page: index + 1, total: pages.length })}
              aria-current={index === shown ? 'page' : undefined}
            >
              <span
                className={cn(
                  'h-2 rounded-full transition-all duration-500',
                  index === shown ? 'w-8 bg-primary' : 'w-2 bg-border',
                )}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={() => go(shown + 1)}
            disabled={shown === pages.length - 1}
            className="rounded-full border border-border p-2.5 text-foreground transition-colors hover:bg-muted disabled:opacity-30"
            aria-label={t('nextPage')}
          >
            <ChevronRight className="size-6 rtl:rotate-180" aria-hidden />
          </button>
          <span className="ms-2 whitespace-nowrap text-lg tabular-nums text-muted-foreground">
            {shown + 1} / {pages.length}
          </span>
        </nav>
      )}
    </div>
  );
}
