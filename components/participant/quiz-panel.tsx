'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Check, Timer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { submitQuizAnswerAction } from '@/lib/actions/quiz';
import type { LeaderboardRow, ParticipantQuizView } from '@/lib/queries/quiz';
import { cn } from '@/lib/utils/cn';

/**
 * Counts down from the server-stamped start time, so every phone in the room
 * shows the same number regardless of when it loaded the page.
 *
 * The clock is state and the remaining seconds are derived during render;
 * `now` starts null so the server and client agree on the first paint.
 */
function useCountdown(startedAt: string | null, limitSeconds: number) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt || now === null) return null;

  const deadline = new Date(startedAt).getTime() + limitSeconds * 1000;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function QuizPanel({
  view,
  leaderboard,
  participantId,
}: {
  view: ParticipantQuizView;
  leaderboard: LeaderboardRow[];
  participantId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const question = view.question;
  const startedAt = question?.startedAt ? new Date(question.startedAt).toISOString() : null;
  const remaining = useCountdown(startedAt, question?.timeLimitSeconds ?? 20);

  // Selection is cleared between questions by remounting: the page keys this
  // component on the current question id.
  if (view.status === 'closed' || !question) {
    return (
      <div className="space-y-5">
        <Card className="p-5 text-center">
          <h2 className="text-lg font-semibold">
            {view.status === 'closed' ? 'Quiz finished' : 'Get ready'}
          </h2>
          {view.myScore && (
            <p className="mt-2 text-muted-foreground">
              You scored{' '}
              <span className="font-semibold text-foreground">
                {view.myScore.score.toLocaleString()}
              </span>{' '}
              with {view.myScore.correctAnswers} correct.
            </p>
          )}
          {view.status !== 'closed' && !view.myScore && (
            <p className="mt-2 text-sm text-muted-foreground">
              The host will start the next question shortly.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Leaderboard</h3>
          <Leaderboard rows={leaderboard} highlightParticipantId={participantId} />
        </Card>
      </div>
    );
  }

  const answered = view.myAnswer !== null;
  const timeUp = remaining === 0;
  const locked = answered || timeUp || view.answerRevealed;

  function submit() {
    startTransition(async () => {
      const result = await submitQuizAnswerAction({
        questionId: question!.id,
        optionIds: selected,
      });
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Question {view.questionNumber} of {view.totalQuestions}
        </span>
        {!locked && remaining !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
              remaining <= 5
                ? 'bg-destructive-subtle text-destructive'
                : 'bg-muted text-foreground',
            )}
            role="timer"
            aria-live="off"
          >
            <Timer className="size-4" aria-hidden />
            {remaining}s
          </span>
        )}
      </div>

      <h1 className="text-xl font-semibold leading-snug">{question.title}</h1>

      <Card className="p-5">
        <div className="space-y-2">
          {question.options.map((option) => {
            const chosen = selected.includes(option.id);
            const wasMine = view.myAnswer?.optionIds.includes(option.id) ?? false;
            const isCorrect = question.correctOptionIds.includes(option.id);
            const revealed = view.answerRevealed;

            return (
              <button
                key={option.id}
                type="button"
                disabled={locked}
                onClick={() => setSelected([option.id])}
                aria-pressed={chosen || wasMine}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-[15px] transition-colors',
                  revealed && isCorrect && 'border-success bg-success-subtle',
                  revealed && !isCorrect && wasMine && 'border-destructive bg-destructive-subtle',
                  !revealed && (chosen || wasMine)
                    ? 'border-primary bg-primary-subtle font-medium text-primary'
                    : !revealed && 'border-border hover:border-primary',
                  locked && 'cursor-not-allowed',
                )}
              >
                <span className="min-w-0 flex-1">{option.text}</span>
                {revealed && isCorrect && (
                  <Check className="size-4 shrink-0 text-success" aria-label="Correct" />
                )}
                {revealed && !isCorrect && wasMine && (
                  <X className="size-4 shrink-0 text-destructive" aria-label="Your answer" />
                )}
              </button>
            );
          })}
        </div>

        {!locked && (
          <Button
            className="mt-4 w-full"
            size="lg"
            loading={pending}
            disabled={selected.length === 0}
            onClick={submit}
          >
            Lock in answer
          </Button>
        )}

        {answered && !view.answerRevealed && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Answer locked in. Waiting for the host…
          </p>
        )}

        {timeUp && !answered && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Time is up for this question.
          </p>
        )}

        {view.answerRevealed && view.myAnswer && (
          <p
            className={cn(
              'mt-4 text-center text-sm font-medium',
              view.myAnswer.correct ? 'text-success' : 'text-destructive',
            )}
          >
            {view.myAnswer.correct
              ? `Correct — ${view.myAnswer.points.toLocaleString()} points`
              : 'Not quite'}
          </p>
        )}

        {view.answerRevealed && question.explanation && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {question.explanation}
          </p>
        )}
      </Card>

      {view.answerRevealed && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Leaderboard</h3>
          <Leaderboard rows={leaderboard} highlightParticipantId={participantId} />
        </Card>
      )}
    </div>
  );
}
