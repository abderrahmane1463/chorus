'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { QuestionCard } from '@/components/interactions/question-card';
import { moderateQuestionAction } from '@/lib/actions/question';
import type { QuestionItem, QuestionSort } from '@/lib/queries/questions';
import { cn } from '@/lib/utils/cn';
import { pluralize } from '@/lib/utils/format';

const SORTS: { value: QuestionSort; label: string }[] = [
  { value: 'votes', label: 'Most votes' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

type Filter = 'all' | 'pending' | 'answered' | 'hidden';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'answered', label: 'Answered' },
  { value: 'hidden', label: 'Hidden' },
];

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
              {option.label}
              {option.value === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 tabular-nums">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as QuestionSort)}
            className="rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={
            filter === 'all' ? 'No questions yet' : `Nothing ${filter}`
          }
          description={
            filter === 'all'
              ? 'Questions from the room appear here as they arrive.'
              : undefined
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {pluralize(visible.length, 'question')}
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
                        onClick={() => moderate(question.id, 'approved', 'Question approved')}
                        className="font-medium text-primary hover:underline"
                      >
                        Approve
                      </button>
                    )}
                    {question.status !== 'answered' && question.status !== 'pending' && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'answered', 'Marked answered')}
                        className="font-medium text-primary hover:underline"
                      >
                        Mark answered
                      </button>
                    )}
                    {question.isHighlighted ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'unhighlight', 'Removed from screen')}
                        className="font-medium text-accent hover:underline"
                      >
                        Remove from screen
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'highlight', 'Showing on screen')}
                        className="font-medium text-accent hover:underline"
                      >
                        Show on screen
                      </button>
                    )}
                    {question.status !== 'hidden' ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'hidden', 'Question hidden')}
                        className="text-muted-foreground hover:underline"
                      >
                        Hide
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => moderate(question.id, 'approved', 'Question restored')}
                        className="text-muted-foreground hover:underline"
                      >
                        Unhide
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => moderate(question.id, 'archived', 'Question archived')}
                      className="text-muted-foreground hover:underline"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => moderate(question.id, 'delete', 'Question deleted')}
                      className="text-destructive hover:underline"
                    >
                      Delete
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
