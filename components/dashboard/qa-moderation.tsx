'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { QuestionCard } from '@/components/interactions/question-card';
import { moderateQuestionAction } from '@/lib/actions/question';
import type { QuestionItem, QuestionSort } from '@/lib/queries/questions';
import { cn } from '@/lib/utils/cn';

const SORTS = [
  { value: 'votes', key: 'sortVotes' },
  { value: 'newest', key: 'sortNewest' },
  { value: 'oldest', key: 'sortOldest' },
] as const;

type Filter = 'all' | 'pending' | 'answered' | 'hidden';

const FILTERS = [
  { value: 'all', key: 'all' },
  { value: 'pending', key: 'pending' },
  { value: 'answered', key: 'answered' },
  { value: 'hidden', key: 'hidden' },
] as const;

export function QaModeration({
  questions,
  sort,
  onSortChange,
}: {
  questions: QuestionItem[];
  sort: QuestionSort;
  onSortChange: (sort: QuestionSort) => void;
}) {
  const router = useRouter();
  const t = useTranslations('moderation');
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, startTransition] = useTransition();

  function moderate(questionId: string, action: string, message: string) {
    startTransition(async () => {
      const result = await moderateQuestionAction({ questionId, action });
      if (result.ok) {
        toast.success(message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const visible =
    filter === 'all'
      ? questions
      : questions.filter((question) => question.status === filter);

  const pendingCount = questions.filter((q) => q.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm transition-colors',
                filter === option.value
                  ? 'bg-primary-subtle font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t(option.key)}
              {option.value === 'pending' && pendingCount > 0 && (
                <span className="ms-1.5 tabular-nums">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('sort')}
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as QuestionSort)}
            className="rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={
            filter === 'all'
              ? t('noneTitle')
              : filter === 'pending'
                ? t('nothingPending')
                : filter === 'answered'
                  ? t('nothingAnswered')
                  : t('nothingHidden')
          }
          description={
            filter === 'all'
              ? t('noneBody')
              : undefined
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t('count', { count: visible.length })}
          </p>
          <ul className="space-y-2">
            {visible.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                actions={
                  <>
                    {question.status === 'pending' && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'approved', t('approved'))}
                        className="font-medium text-primary hover:underline"
                      >
                        {t('approve')}
                      </button>
                    )}
                    {question.status !== 'answered' && question.status !== 'pending' && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'answered', t('markedAnswered'))}
                        className="font-medium text-primary hover:underline"
                      >
                        {t('markAnswered')}
                      </button>
                    )}
                    {question.isHighlighted ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'unhighlight', t('removedFromScreen'))}
                        className="font-medium text-accent hover:underline"
                      >
                        {t('removeFromScreen')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'highlight', t('showingOnScreen'))}
                        className="font-medium text-accent hover:underline"
                      >
                        {t('showOnScreen')}
                      </button>
                    )}
                    {question.status !== 'hidden' ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'hidden', t('hiddenToast'))}
                        className="text-muted-foreground hover:underline"
                      >
                        {t('hide')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'approved', t('restored'))}
                        className="text-muted-foreground hover:underline"
                      >
                        {t('unhide')}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => moderate(question.id, 'archived', t('archived'))}
                      className="text-muted-foreground hover:underline"
                    >
                      {t('archive')}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => moderate(question.id, 'delete', t('deleted'))}
                      className="text-destructive hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
