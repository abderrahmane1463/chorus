'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import type { QuestionItem } from '@/lib/queries/questions';

/** How long each page of questions stays up before the next. */
const PAGE_MS = 10_000;

/**
 * The room's questions on the big screen, all of them.
 *
 * As many as fit the screen are shown at once, most-voted first. When there
 * are more, the board turns its pages by itself, so every question gets its
 * time on screen and the host never has to scroll a projector. Pages are cut
 * from each question's real height, so a long question that wraps onto two
 * lines never pushes the last one off the bottom.
 */
export function QaBoard({ title, questions }: { title: string; questions: QuestionItem[] }) {
  const t = useTranslations('presenter');
  const reduceMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState<QuestionItem[][]>([questions]);
  const [page, setPage] = useState(0);

  // Cut the questions into pages that fit the space left for the list.
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
      const gap = 20;

      const next: QuestionItem[][] = [];
      let current: QuestionItem[] = [];
      let used = 0;
      questions.forEach((question, index) => {
        const height = heights[index] ?? 0;
        if (current.length > 0 && used + gap + height > available) {
          next.push(current);
          current = [];
          used = 0;
        }
        used += (current.length > 0 ? gap : 0) + height;
        current.push(question);
      });
      if (current.length > 0) next.push(current);

      setPages(next.length > 0 ? next : [[]]);
    };

    paginate();
    window.addEventListener('resize', paginate);
    return () => window.removeEventListener('resize', paginate);
  }, [questions]);

  // A page that no longer exists, after questions were answered or hidden.
  const shown = Math.min(page, pages.length - 1);

  useEffect(() => {
    if (pages.length <= 1) return;
    const timer = setInterval(() => setPage((current) => (current + 1) % pages.length), PAGE_MS);
    return () => clearInterval(timer);
  }, [pages.length]);

  const rows = (items: QuestionItem[]) =>
    items.map((question) => (
      <li key={question.id} className="flex gap-6">
        <span className="w-16 shrink-0 text-end text-4xl font-semibold tabular-nums text-primary">
          {question.votes}
        </span>
        <div className="min-w-0">
          <p className="text-3xl leading-snug [overflow-wrap:anywhere]">{question.text}</p>
          <p className="mt-1 text-xl text-muted-foreground">
            {question.authorName ?? t('anonymous')}
          </p>
        </div>
      </li>
    ));

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between gap-6">
        <h2 className="text-4xl font-semibold">{title}</h2>
        {questions.length > 0 && (
          <p className="shrink-0 text-xl text-muted-foreground">
            {t('questionTotal', { count: questions.length })}
          </p>
        )}
      </div>

      {questions.length === 0 ? (
        <p className="text-2xl text-muted-foreground">{t('noQuestions')}</p>
      ) : (
        <div ref={listRef} className="relative">
          {/* Every question laid out unseen at full width, to learn its height.
              Clipped to nothing, so it never lengthens the page. */}
          <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
            <ul ref={measureRef}>{rows(questions)}</ul>
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
            <div className="mt-6 flex items-center gap-3" aria-label={t('pageOf', { page: shown + 1, total: pages.length })}>
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
      )}
    </>
  );
}
