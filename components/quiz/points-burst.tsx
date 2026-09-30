'use client';

import { useLayoutEffect, useRef } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

/**
 * The moment a participant learns what their answer was worth.
 *
 * The count-up writes straight to the DOM node instead of going through React
 * state: sixty state updates a second on a mid-range phone is exactly the
 * jank this screen cannot afford.
 */
export function PointsBurst({ correct, points }: { correct: boolean; points: number }) {
  const t = useTranslations('quiz');
  const format = useFormatter();
  const reduceMotion = useReducedMotion();
  const number = useRef<HTMLSpanElement>(null);

  // A layout effect, not a plain effect: it runs before the browser paints, so
  // the count starts from zero on the very first frame. With a plain effect
  // the final score was visible for one frame before dropping and climbing.
  useLayoutEffect(() => {
    const node = number.current;
    if (!node || !correct) return;

    const show = (value: number) => {
      node.textContent = `+${format.number(Math.round(value))}`;
    };

    if (reduceMotion) {
      show(points);
      return;
    }

    show(0);
    const controls = animate(0, points, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: show,
    });
    return () => controls.stop();
  }, [correct, points, reduceMotion, format]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={cn(
        'mt-4 rounded-xl px-4 py-5 text-center',
        correct ? 'bg-success-subtle text-success' : 'bg-destructive-subtle text-destructive',
      )}
      role="status"
    >
      {correct ? (
        <>
          {/* Rendered with the final value, which is what stays on screen if
              the count-up never runs. The layout effect replaces it before
              the first paint when it does. */}
          <span ref={number} dir="ltr" className="block text-5xl font-semibold tabular-nums">
            +{format.number(points)}
          </span>
          <span className="mt-1 block text-sm font-medium">
            {t('pointsCaption', { points })}
          </span>
        </>
      ) : (
        <span className="block text-2xl font-semibold">{t('notQuite')}</span>
      )}
    </motion.div>
  );
}
