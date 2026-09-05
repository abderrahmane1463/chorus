'use client';

import { ArrowBigUp, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { QuestionItem } from '@/lib/queries/questions';

export function QuestionCard({
  question,
  onUpvote,
  upvoteDisabled = false,
  actions,
}: {
  question: QuestionItem;
  onUpvote?: (questionId: string) => void;
  upvoteDisabled?: boolean;
  /** Host moderation controls, rendered under the question text. */
  actions?: React.ReactNode;
}) {
  const canVote = Boolean(onUpvote) && !upvoteDisabled;

  return (
    <li
      className={cn(
        'flex gap-3 rounded-lg border p-4',
        question.isHighlighted ? 'border-accent bg-accent-subtle' : 'border-border',
        question.status === 'hidden' && 'opacity-55',
      )}
    >
      {/* The count is always shown. Hosts do not vote, but they need to see
          which questions the room has pushed to the top. */}
      {onUpvote ? (
        <button
          type="button"
          onClick={() => onUpvote(question.id)}
          disabled={upvoteDisabled}
          aria-pressed={question.votedByMe}
          aria-label={question.votedByMe ? 'Remove your upvote' : 'Upvote this question'}
          className={cn(
            'flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-md border text-sm font-semibold transition-colors',
            question.votedByMe
              ? 'border-primary bg-primary-subtle text-primary'
              : 'border-border text-muted-foreground',
            canVote && 'hover:border-primary hover:text-primary',
            upvoteDisabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <ArrowBigUp className="size-4" aria-hidden />
          <span className="tabular-nums">{question.votes}</span>
        </button>
      ) : (
        <div
          className="flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-border text-sm font-semibold text-muted-foreground"
          title={`${question.votes} upvotes`}
        >
          <ArrowBigUp className="size-4" aria-hidden />
          <span className="tabular-nums">{question.votes}</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {question.text}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{question.authorName ?? 'Anonymous'}</span>
          {question.isMine && <span>· you</span>}

          {question.status === 'answered' && <Badge variant="primary">Answered</Badge>}
          {question.status === 'pending' && <Badge>Awaiting approval</Badge>}
          {question.status === 'hidden' && <Badge variant="destructive">Hidden</Badge>}
          {question.isHighlighted && (
            <Badge variant="accent">
              <Star className="size-3" aria-hidden />
              On screen
            </Badge>
          )}
        </div>

        {actions && <div className="mt-3 flex flex-wrap gap-3 text-xs">{actions}</div>}
      </div>
    </li>
  );
}
