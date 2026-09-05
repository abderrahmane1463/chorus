'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowBigUp, Radio } from 'lucide-react';

/**
 * Product preview for the hero. This is an illustration of the live poll and
 * Q&A surfaces, not a connected client — the real thing lives behind sign-in.
 */
const options = [
  { label: 'Email newsletters', share: 46 },
  { label: 'Paid social', share: 31 },
  { label: 'Search ads', share: 15 },
  { label: 'Events', share: 8 },
];

const questions = [
  { text: 'How do you measure attribution across channels?', votes: 24 },
  { text: 'Which budget split worked best for you last quarter?', votes: 17 },
];

export function HeroPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid gap-4 sm:grid-cols-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:col-span-3">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success">
            <Radio className="size-3" aria-hidden />
            Live
          </span>
          <span className="font-mono text-xs text-muted-foreground">BRAVO-42</span>
        </div>

        <h3 className="text-base font-semibold">
          Where does most of your pipeline come from?
        </h3>

        <ul className="mt-4 space-y-2.5">
          {options.map((option, index) => (
            <li key={option.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span>{option.label}</span>
                <span className="tabular-nums text-muted-foreground">{option.share}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${option.share}%` }}
                  transition={{ duration: 0.9, delay: 0.15 * index, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">148 responses</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:col-span-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Top questions</h3>
        <ul className="mt-4 space-y-3">
          {questions.map((question) => (
            <li key={question.text} className="flex gap-3">
              <span className="flex h-11 w-9 shrink-0 flex-col items-center justify-center rounded-md border border-border text-xs font-semibold">
                <ArrowBigUp className="size-3.5 text-primary" aria-hidden />
                <span className="tabular-nums">{question.votes}</span>
              </span>
              <p className="text-sm leading-snug">{question.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
