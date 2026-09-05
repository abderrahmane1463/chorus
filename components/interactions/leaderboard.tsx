import { Trophy } from 'lucide-react';
import type { LeaderboardRow } from '@/lib/queries/quiz';
import { cn } from '@/lib/utils/cn';

const MEDALS = ['text-amber-500', 'text-neutral-400', 'text-amber-700'];

export function Leaderboard({
  rows,
  highlightParticipantId,
  emphasis = false,
}: {
  rows: LeaderboardRow[];
  /** Marks the viewer's own row so they can find themselves. */
  highlightParticipantId?: string;
  emphasis?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className={cn('text-muted-foreground', emphasis ? 'text-2xl' : 'text-sm')}>
        No scores yet.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const mine = row.participantId === highlightParticipantId;
        return (
          <li
            key={row.participantId}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4',
              emphasis ? 'py-4 text-2xl' : 'py-2.5 text-sm',
              mine ? 'border-primary bg-primary-subtle' : 'border-border',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center font-semibold tabular-nums',
                emphasis ? 'w-12 text-3xl' : 'w-7',
              )}
            >
              {row.rank <= 3 ? (
                <Trophy
                  className={cn(emphasis ? 'size-8' : 'size-4', MEDALS[row.rank - 1])}
                  aria-label={`Rank ${row.rank}`}
                />
              ) : (
                row.rank
              )}
            </span>

            <span className="min-w-0 flex-1 truncate font-medium">
              {row.displayName ?? 'Anonymous'}
              {mine && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  you
                </span>
              )}
            </span>

            <span className="shrink-0 text-muted-foreground">
              {row.correctAnswers} correct
            </span>
            <span
              className={cn(
                'shrink-0 font-semibold tabular-nums',
                emphasis ? 'w-28 text-right' : 'w-16 text-right',
              )}
            >
              {row.score.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
