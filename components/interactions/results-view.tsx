import { EyeOff } from 'lucide-react';
import type { InteractionResults } from '@/lib/queries/interactions';
import { pluralize } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/** Scales word size by frequency, with a floor so rare words stay readable. */
function wordSize(count: number, max: number): string {
  if (max <= 1) return '1.25rem';
  const ratio = (count - 1) / (max - 1);
  return `${(1 + ratio * 1.9).toFixed(2)}rem`;
}

export function ResultsView({
  results,
  emphasis = false,
  myOptionIds,
  myRating,
}: {
  results: InteractionResults;
  /** Larger type for the presenter screen. */
  emphasis?: boolean;
  myOptionIds?: string[];
  myRating?: number;
}) {
  if (results.total === 0) {
    return (
      <p className={cn('text-muted-foreground', emphasis ? 'text-2xl' : 'text-sm')}>
        No answers yet.
      </p>
    );
  }

  switch (results.kind) {
    case 'multiple_choice':
      return (
        <div className="space-y-3">
          {results.options.map((option) => {
            const mine = myOptionIds?.includes(option.id);
            return (
              <div key={option.id}>
                <div
                  className={cn(
                    'mb-1.5 flex items-baseline justify-between gap-3',
                    emphasis ? 'text-2xl' : 'text-sm',
                  )}
                >
                  <span className={cn(mine && 'font-semibold text-primary')}>
                    {option.text}
                    {mine && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        your answer
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {option.share}% · {option.votes}
                  </span>
                </div>
                <div
                  className={cn(
                    'overflow-hidden rounded-full bg-muted',
                    emphasis ? 'h-4' : 'h-2.5',
                  )}
                >
                  <div
                    className="bar-fill h-full rounded-full bg-primary"
                    style={{ width: `${option.share}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className={cn('text-muted-foreground', emphasis ? 'text-xl' : 'text-xs')}>
            {pluralize(results.total, 'response')}
          </p>
        </div>
      );

    case 'rating': {
      const peak = Math.max(...results.distribution.map((bucket) => bucket.count), 1);
      // Bar heights are in pixels, not percentages: a percentage height inside
      // an auto-height flex column has no definite parent to resolve against,
      // which collapses every bar to nothing.
      const chartHeight = emphasis ? 200 : 110;

      return (
        <div>
          <div className="mb-4 flex items-baseline gap-2">
            <span
              className={cn('font-semibold tabular-nums', emphasis ? 'text-6xl' : 'text-3xl')}
            >
              {results.average}
            </span>
            <span className={cn('text-muted-foreground', emphasis ? 'text-2xl' : 'text-sm')}>
              average from {pluralize(results.total, 'response')}
            </span>
          </div>

          <div className="flex items-end gap-1.5">
            {results.distribution.map((bucket) => (
              <div key={bucket.value} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'tabular-nums text-muted-foreground',
                    emphasis ? 'text-xl' : 'text-xs',
                  )}
                >
                  {bucket.count}
                </span>
                <div
                  className={cn(
                    'bar-fill w-full rounded-t-md',
                    myRating === bucket.value ? 'bg-accent' : 'bg-primary',
                  )}
                  style={{
                    height: Math.max((bucket.count / peak) * chartHeight, 4),
                  }}
                />
                <span
                  className={cn(
                    'tabular-nums text-muted-foreground',
                    emphasis ? 'text-lg' : 'text-xs',
                  )}
                >
                  {bucket.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'word_cloud': {
      const peak = results.words[0]?.count ?? 1;
      return (
        <div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {results.words.map((entry) => (
              <span
                key={entry.word}
                title={pluralize(entry.count, 'mention')}
                className="font-medium leading-tight text-primary"
                style={{
                  fontSize: emphasis
                    ? `calc(${wordSize(entry.count, peak)} * 1.9)`
                    : wordSize(entry.count, peak),
                  opacity: 0.55 + (entry.count / peak) * 0.45,
                }}
              >
                {entry.word}
              </span>
            ))}
          </div>
          <p
            className={cn('mt-4 text-muted-foreground', emphasis ? 'text-xl' : 'text-xs')}
          >
            {pluralize(results.total, 'submission')}
          </p>
        </div>
      );
    }

    case 'ranking':
      return (
        <div>
          <ol className="space-y-2">
            {results.options.map((option) => (
              <li
                key={option.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-border px-4',
                  emphasis ? 'py-4 text-2xl' : 'py-2.5 text-sm',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 font-semibold tabular-nums text-primary',
                    emphasis ? 'w-10 text-3xl' : 'w-6',
                  )}
                >
                  {option.rank}
                </span>
                <span className="min-w-0 flex-1">{option.text}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  avg {option.averagePosition.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
          <p
            className={cn('mt-4 text-muted-foreground', emphasis ? 'text-xl' : 'text-xs')}
          >
            {pluralize(results.total, 'ranking')} · lower average is higher placed
          </p>
        </div>
      );

    case 'open_text':
      return (
        <div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.entries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  'rounded-lg border border-border p-3 leading-relaxed',
                  emphasis ? 'text-xl' : 'text-sm',
                  entry.hidden && 'opacity-45',
                )}
              >
                {entry.hidden && (
                  <span className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <EyeOff className="size-3" />
                    Hidden
                  </span>
                )}
                <span className="whitespace-pre-wrap break-words">{entry.text}</span>
              </li>
            ))}
          </ul>
          <p
            className={cn('mt-4 text-muted-foreground', emphasis ? 'text-xl' : 'text-xs')}
          >
            {pluralize(results.total, 'response')}
          </p>
        </div>
      );

    default:
      return (
        <p className="text-sm text-muted-foreground">
          {pluralize(results.total, 'response')}
        </p>
      );
  }
}
