'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Timer, Users, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { CountdownBar, useCountdown, useSecondsUntil } from '@/components/quiz/countdown';
import { PointsBurst } from '@/components/quiz/points-burst';
import { useQuizPacer } from '@/hooks/use-quiz-pacer';
import { submitQuizAnswerAction } from '@/lib/actions/quiz';
import type { LeaderboardRow, ParticipantQuizView } from '@/lib/queries/quiz';
import { cn } from '@/lib/utils/cn';

export function QuizPanel({
  view,
  leaderboard,
  participantId,
  serverNow,
}: {
  view: ParticipantQuizView;
  leaderboard: LeaderboardRow[];
  participantId: string;
  /** The server's clock when it rendered, so the timer ignores a wrong phone clock. */
  serverNow: number;
}) {
  const router = useRouter();
  const t = useTranslations('quiz');
  // Scores are read aloud in the room: they follow the reader's digits and
  // grouping, so 1200 is "1,200", "1 200" or "١٬٢٠٠".
  const format = useFormatter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const question = view.question;
  const startedAt = question?.startedAt ? new Date(question.startedAt).toISOString() : null;
  const countdown = useCountdown(startedAt, question?.timeLimitSeconds ?? 20, serverNow);
  const remaining = countdown?.remaining ?? null;
  const nextIn = useSecondsUntil(view.phase === 'revealed' ? view.dueAt : null, serverNow);

  // Every phone is a fallback for keeping the quiz moving, in case the host's
  // screens are closed when a step comes due.
  useQuizPacer({ quizId: view.quizId, dueAt: view.dueAt, serverNow, role: 'participant' });

  if (view.phase === 'lobby') {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <Check className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-semibold">{t('lobbyTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('lobbyBody')}</p>
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          <span aria-live="polite">{t('playersIn', { count: view.playerCount })}</span>
        </p>
      </Card>
    );
  }

  // Selection is cleared between questions by remounting: the page keys this
  // component on the current question id.
  if (!question) {
    return (
      <div className="space-y-5">
        <Card className="p-5 text-center">
          <h2 className="text-lg font-semibold">
            {view.phase === 'finished' ? t('finished') : t('notStarted')}
          </h2>
          {view.myScore && (
            <p className="mt-2 text-muted-foreground">
              {t('scored', {
                score: format.number(view.myScore.score),
                correct: view.myScore.correctAnswers,
              })}
            </p>
          )}
        </Card>

        {leaderboard.length > 0 && (
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
              {t('leaderboard')}
            </h3>
            <Leaderboard rows={leaderboard} highlightParticipantId={participantId} />
          </Card>
        )}
      </div>
    );
  }

  const answered = view.myAnswer !== null;
  const position = t('questionOf', {
    number: view.questionNumber ?? 1,
    total: view.totalQuestions,
  });

  // Until the clock has ticked once it is not known whether the question has
  // opened, so the answers stay hidden rather than flash up early.
  const gettingReady =
    !view.answerRevealed && !answered && (countdown === null || countdown.startsIn > 0);

  if (gettingReady) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-sm text-muted-foreground">{position}</p>
        <h1 className="text-xl font-semibold leading-snug">{question.title}</h1>
        <Card className="p-6">
          <p className="text-muted-foreground">{t('getReady')}</p>
          <p className="mt-1 text-6xl font-semibold tabular-nums text-primary" role="timer">
            {/* A dash for the instant before the first tick. */}
            {countdown ? format.number(countdown.startsIn) : '–'}
          </p>
        </Card>
      </div>
    );
  }

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
        <span className="text-sm text-muted-foreground">{position}</span>
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
            {t('secondsLeft', { count: remaining })}
          </span>
        )}
      </div>

      {!locked && countdown && startedAt && (
        <CountdownBar
          startedAt={startedAt}
          limitSeconds={question.timeLimitSeconds}
          countdown={countdown}
        />
      )}

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
                  'flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-start text-[15px] transition-colors',
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
                  <Check className="size-4 shrink-0 text-success" aria-label={t('correctLabel')} />
                )}
                {revealed && !isCorrect && wasMine && (
                  <X className="size-4 shrink-0 text-destructive" aria-label={t('yourAnswerLabel')} />
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
            {t('lockIn')}
          </Button>
        )}

        {answered && !view.answerRevealed && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t('lockedWaiting')}
          </p>
        )}

        {timeUp && !answered && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t('timeUp')}
          </p>
        )}

        {view.answerRevealed && view.myAnswer && (
          <PointsBurst
            correct={view.myAnswer.correct}
            points={view.myAnswer.points}
          />
        )}

        {view.answerRevealed && !view.myAnswer && (
          <p className="mt-4 text-center text-sm text-muted-foreground">{t('noAnswer')}</p>
        )}

        {view.answerRevealed && question.explanation && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {question.explanation}
          </p>
        )}
      </Card>

      {view.answerRevealed && nextIn !== null && (
        <p className="text-center text-sm text-muted-foreground" role="timer" aria-live="off">
          {view.hasNext
            ? t('nextIn', { seconds: format.number(nextIn) })
            : t('resultsIn', { seconds: format.number(nextIn) })}
        </p>
      )}

      {view.answerRevealed && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">{t('leaderboard')}</h3>
          <Leaderboard rows={leaderboard} highlightParticipantId={participantId} />
        </Card>
      )}
    </div>
  );
}
