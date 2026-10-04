'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Hourglass, Timer, Users, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { TileLetter, tileFor } from '@/components/quiz/answer-tiles';
import { CountdownBar, useCountdown, useSecondsUntil } from '@/components/quiz/countdown';
import { PointsBurst } from '@/components/quiz/points-burst';
import { useQuizPacer } from '@/hooks/use-quiz-pacer';
import { setNicknameAction } from '@/lib/actions/join';
import { submitQuizAnswerAction } from '@/lib/actions/quiz';
import type { LeaderboardRow, ParticipantQuizView, PlayerStanding } from '@/lib/queries/quiz';
import { cn } from '@/lib/utils/cn';

type Option = { id: string; text: string };

/**
 * A quiz on a participant's phone.
 *
 * The phone is a controller more than a screen: the question lives on the
 * projector, and here the player gets large targets they can hit without
 * looking down for long. One tap answers.
 */
export function QuizPanel({
  view,
  leaderboard,
  standing,
  participantId,
  eventId,
  displayName,
  serverNow,
}: {
  view: ParticipantQuizView;
  /** The top of the board; the player may not be on it. */
  leaderboard: LeaderboardRow[];
  /** This player's own place, wherever it is. Null before they score. */
  standing: PlayerStanding | null;
  participantId: string;
  eventId: string;
  /** Null when the player joined without a name. */
  displayName: string | null;
  /** The server's clock when it rendered, so the timer ignores a wrong phone clock. */
  serverNow: number;
}) {
  const t = useTranslations('quiz');
  // Scores are read aloud in the room: they follow the reader's digits and
  // grouping, so 1200 is "1,200", "1 200" or "١٬٢٠٠".
  const format = useFormatter();
  const [selected, setSelected] = useState<string[]>([]);
  // What was tapped, shown at once while the server confirms it. Waiting for
  // the round trip before reacting makes a tap feel like it missed.
  const [sent, setSent] = useState<string[] | null>(null);
  const [, startTransition] = useTransition();

  const question = view.question;
  const startedAt = question?.startedAt ? new Date(question.startedAt).toISOString() : null;
  const countdown = useCountdown(startedAt, question?.timeLimitSeconds ?? 20, serverNow);
  const remaining = countdown?.remaining ?? null;
  const nextIn = useSecondsUntil(view.phase === 'revealed' ? view.dueAt : null, serverNow);

  // Every phone is a fallback for keeping the quiz moving, in case the host's
  // screens are closed when a step comes due.
  useQuizPacer({ quizId: view.quizId, dueAt: view.dueAt, serverNow, role: 'participant' });

  if (view.phase === 'lobby') {
    return displayName ? (
      <Card className="p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <Check className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-semibold">{t('lobbyTitle')}</h2>
        <p dir="auto" className="mt-1 text-2xl font-semibold text-primary">
          {displayName}
        </p>
        <p className="mt-3 text-muted-foreground">{t('lobbyBody')}</p>
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          <span aria-live="polite">{t('playersIn', { count: view.playerCount })}</span>
        </p>
      </Card>
    ) : (
      <NicknameForm eventId={eventId} />
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

  const position = t('questionOf', {
    number: view.questionNumber ?? 1,
    total: view.totalQuestions,
  });

  const myAnswerIds = view.myAnswer?.optionIds ?? sent;
  const answered = myAnswerIds !== null;

  // Until the clock has ticked once it is not known whether the question has
  // opened, so the answers stay hidden rather than flash up early.
  const gettingReady =
    !view.answerRevealed && !answered && (countdown === null || countdown.startsIn > 0);

  if (gettingReady) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-sm text-muted-foreground">{position}</p>
        <h1 className="text-xl font-semibold leading-snug"><bdi>{question.title}</bdi></h1>
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

  function submit(optionIds: string[]) {
    if (optionIds.length === 0 || sent) return;
    setSent(optionIds);

    startTransition(async () => {
      const result = await submitQuizAnswerAction({
        questionId: question!.id,
        optionIds,
      });
      // Nothing to fetch when it counted: the screen already says "Answer
      // sent", and the reveal brings the result. A refetch here would be one
      // more page render per player per question, all landing together.
      if (!result.ok) {
        // The tap did not count (time ran out on the way, say), so give the
        // tiles back rather than leave the player looking at a false "sent".
        setSent(null);
        toast.error(result.error);
      }
    });
  }

  function toggle(optionId: string) {
    setSelected((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  }

  const indexOf = (optionId: string) =>
    question.options.findIndex((option) => option.id === optionId);

  if (view.answerRevealed) {
    const correct = question.options.filter((option) =>
      question.correctOptionIds.includes(option.id),
    );

    return (
      <div className="space-y-5">
        <p className="text-center text-sm text-muted-foreground">{position}</p>

        {view.myAnswer ? (
          <PointsBurst correct={view.myAnswer.correct} points={view.myAnswer.points} />
        ) : (
          <div className="rounded-xl bg-muted px-4 py-5 text-center" role="status">
            <span className="block text-2xl font-semibold">{t('noAnswerTitle')}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{t('noAnswer')}</span>
          </div>
        )}

        {standing && (
          <p className="text-center text-lg font-medium">
            {t('yourRank', {
              rank: format.number(standing.rank),
              total: format.number(standing.total),
            })}
            {/* Two numbers side by side read as one ("3" and "0" as "30"), and
                in Arabic they also swap places. The dot and the isolated box
                keep them apart and in order. */}
            <span aria-hidden className="mx-2 text-muted-foreground">
              ·
            </span>
            <span className="inline-block text-muted-foreground">
              {t('totalPoints', { points: format.number(standing.score) })}
            </span>
          </p>
        )}

        <Card className="p-5">
          <h2 className="font-semibold leading-snug"><bdi>{question.title}</bdi></h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('correctAnswers', { count: correct.length })}
          </p>
          <ul className="mt-2 space-y-2">
            {correct.map((option) => (
              <AnswerChip key={option.id} option={option} index={indexOf(option.id)} />
            ))}
          </ul>

          {view.myAnswer && !view.myAnswer.correct && (
            <>
              <p className="mt-4 text-sm text-muted-foreground">{t('yourAnswerWas')}</p>
              <ul className="mt-2 space-y-2">
                {view.myAnswer.optionIds.map((optionId) => {
                  const option = question.options[indexOf(optionId)];
                  return option ? (
                    <AnswerChip key={optionId} option={option} index={indexOf(optionId)} wrong />
                  ) : null;
                })}
              </ul>
            </>
          )}

          {question.explanation && (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {question.explanation}
            </p>
          )}
        </Card>

        {nextIn !== null && (
          <p className="text-center text-sm text-muted-foreground" role="timer" aria-live="off">
            {view.hasNext
              ? t('nextIn', { seconds: format.number(nextIn) })
              : t('resultsIn', { seconds: format.number(nextIn) })}
          </p>
        )}

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">{t('leaderboard')}</h3>
          <Leaderboard rows={leaderboard} highlightParticipantId={participantId} />
        </Card>
      </div>
    );
  }

  if (answered) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-sm text-muted-foreground">{position}</p>
        <Card className="p-6">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
            <Hourglass className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-semibold">{t('answerSent')}</h2>
          <p className="mt-1 text-muted-foreground">{t('lockedWaiting')}</p>
          <ul className="mt-5 space-y-2 text-start">
            {myAnswerIds.map((optionId) => {
              const option = question.options[indexOf(optionId)];
              return option ? (
                <AnswerChip key={optionId} option={option} index={indexOf(optionId)} />
              ) : null;
            })}
          </ul>
        </Card>
      </div>
    );
  }

  if (remaining === 0) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-sm text-muted-foreground">{position}</p>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">{t('timeUpTitle')}</h2>
          <p className="mt-1 text-muted-foreground">{t('timeUp')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{position}</span>
        {remaining !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
              remaining <= 5 ? 'bg-destructive-subtle text-destructive' : 'bg-muted text-foreground',
            )}
            role="timer"
            aria-live="off"
          >
            <Timer className="size-4" aria-hidden />
            {t('secondsLeft', { count: remaining })}
          </span>
        )}
      </div>

      {countdown && startedAt && (
        <CountdownBar
          startedAt={startedAt}
          limitSeconds={question.timeLimitSeconds}
          countdown={countdown}
        />
      )}

      <h1 className="text-lg font-semibold leading-snug"><bdi>{question.title}</bdi></h1>

      {question.multiple && (
        <p className="text-sm text-muted-foreground">{t('pickSeveral')}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {question.options.map((option, index) => {
          const chosen = selected.includes(option.id);

          return (
            <button
              key={option.id}
              type="button"
              // One correct answer: the tap is the answer. Several: the tap
              // selects, and the button below sends them together.
              onClick={() => (question.multiple ? toggle(option.id) : submit([option.id]))}
              aria-pressed={question.multiple ? chosen : undefined}
              className={cn(
                'flex min-h-28 flex-col items-start justify-between gap-3 rounded-xl p-3 text-start text-white transition-transform active:scale-[0.97]',
                tileFor(index).surface,
                question.multiple && chosen && 'ring-4 ring-foreground ring-offset-2 ring-offset-background',
              )}
            >
              <span className="flex w-full items-center justify-between">
                <TileLetter index={index} />
                {question.multiple && chosen && <Check className="size-6" aria-hidden />}
              </span>
              <bdi className="text-[15px] font-medium leading-snug">{option.text}</bdi>
            </button>
          );
        })}
      </div>

      {question.multiple && (
        <Button
          className="w-full"
          size="lg"
          disabled={selected.length === 0}
          onClick={() => submit(selected)}
        >
          {t('submitAnswers')}
        </Button>
      )}
    </div>
  );
}

/** An answer shown back to the player: its letter, colour and text on one line. */
function AnswerChip({
  option,
  index,
  wrong = false,
}: {
  option: Option;
  index: number;
  wrong?: boolean;
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-white',
        tileFor(index).surface,
        wrong && 'opacity-60',
      )}
    >
      <TileLetter index={index} />
      <bdi className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{option.text}</bdi>
      {wrong && <X className="size-5 shrink-0" aria-hidden />}
    </li>
  );
}

/**
 * Asks for a name before the quiz starts.
 *
 * Someone who joined the event anonymously would appear on the scoreboard as
 * "Anonymous", alongside everyone else who did the same.
 */
function NicknameForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const t = useTranslations('quiz');
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await setNicknameAction({ eventId, displayName: name });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold">{t('nicknameTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('nicknameBody')}</p>
      <form
        className="mt-5 space-y-3"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={30}
          autoFocus
          autoComplete="nickname"
          aria-label={t('nicknameLabel')}
          placeholder={t('nicknameLabel')}
          className="h-12 text-center text-lg"
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={name.trim().length === 0}
        >
          {t('nicknameSave')}
        </Button>
      </form>
    </Card>
  );
}
