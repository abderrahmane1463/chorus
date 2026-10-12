'use client';

import { useTranslations } from 'next-intl';
import type { QuestionItem } from '@/lib/queries/questions';
import type { InteractionResults } from '@/lib/queries/interactions';
import { PagedList } from './paged-list';

/** The room's questions on the big screen, all of them, most-voted first. */
export function QaBoard({ title, questions }: { title: string; questions: QuestionItem[] }) {
  const t = useTranslations('presenter');

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
        <PagedList
          items={questions}
          keyOf={(question) => question.id}
          render={(question) => (
            <div className="flex gap-6">
              <span className="w-16 shrink-0 text-end text-4xl font-semibold tabular-nums text-primary">
                {question.votes}
              </span>
              <div className="min-w-0">
                <p className="text-3xl leading-snug [overflow-wrap:anywhere]">{question.text}</p>
                <p className="mt-1 text-xl text-muted-foreground">
                  {question.authorName ?? t('anonymous')}
                </p>
              </div>
            </div>
          )}
        />
      )}
    </>
  );
}

type TextEntry = Extract<InteractionResults, { kind: 'open_text' }>['entries'][number];

/**
 * The room's written answers on the big screen, all of them, newest first.
 * Hidden answers never reach the projector.
 */
export function TextBoard({ title, entries }: { title: string; entries: TextEntry[] }) {
  const t = useTranslations('presenter');
  const tResults = useTranslations('results');
  const shown = entries.filter((entry) => !entry.hidden);

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between gap-6">
        <h2 className="text-4xl font-semibold leading-tight">{title}</h2>
        <p className="shrink-0 text-xl text-muted-foreground">
          {tResults('responses', { count: shown.length })}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-2xl text-muted-foreground">{t('noTextYet')}</p>
      ) : (
        <PagedList
          items={shown}
          keyOf={(entry) => entry.id}
          render={(entry) => (
            <p className="whitespace-pre-wrap rounded-xl border border-border bg-card/60 px-6 py-4 text-3xl leading-snug [overflow-wrap:anywhere]">
              {entry.text}
            </p>
          )}
        />
      )}
    </>
  );
}
