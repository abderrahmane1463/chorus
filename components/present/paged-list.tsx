'use client';

import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

/** How long each page stays up before the next. */
const PAGE_MS = 10_000;
/** The space between two items, matching `space-y-5`. */
const GAP = 20;

/**
 * A list for the big screen that never scrolls.
 *
 * As many items as fit the screen are shown at once. When there are more, it
 * turns its pages by itself, so every item gets its time on screen and the
 * host never has to scroll a projector. Pages are cut from each item's real
 * height, so a long one that wraps never pushes the last off the bottom.
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
      const available = Math.max(160, window.innerHeight - footerHeight - top - 32 - 40);
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

  useEffect(() => {
    if (pages.length <= 1) return;
    const timer = setInterval(() => setPage((current) => (current + 1) % pages.length), PAGE_MS);
    return () => clearInterval(timer);
  }, [pages.length]);

  const rows = (list: T[]) => list.map((item) => <li key={keyOf(item)}>{render(item)}</li>);

  return (
    <div ref={listRef} className="relative">
      {/* Every item laid out unseen at full width, to learn its height.
          Clipped to nothing, so it never lengthens the page. */}
      <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <ul ref={measureRef}>{rows(items)}</ul>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.ul
          key={shown}
          className="space-y-5"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
        >
          {rows(pages[shown] ?? [])}
        </motion.ul>
      </AnimatePresence>

      {pages.length > 1 && (
        <div
          className="mt-6 flex items-center gap-3"
          aria-label={t('pageOf', { page: shown + 1, total: pages.length })}
        >
          {pages.map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-2 rounded-full transition-all duration-500',
                index === shown ? 'w-8 bg-primary' : 'w-2 bg-border',
              )}
            />
          ))}
          <span className="ms-2 text-lg tabular-nums text-muted-foreground">
            {shown + 1} / {pages.length}
          </span>
        </div>
      )}
    </div>
  );
}
