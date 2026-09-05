'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/shared/logo';
import { ResultsView } from '@/components/interactions/results-view';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { useEventSync } from '@/hooks/use-event-sync';
import { channels } from '@/lib/realtime/events';
import { setInteractionStatusAction } from '@/lib/actions/interaction';
import type {
  InteractionDetail,
  InteractionListItem,
  InteractionResults,
} from '@/lib/queries/interactions';
import type { QuestionItem } from '@/lib/queries/questions';
import type { LeaderboardRow, QuizDetail } from '@/lib/queries/quiz';
import type { SurveyDetail } from '@/lib/queries/survey';
import { cn } from '@/lib/utils/cn';
import { pluralize } from '@/lib/utils/format';

/** Counts down from the server-stamped start of the current quiz question. */
function useCountdown(startedAt: Date | null | undefined, limitSeconds: number) {
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

export function PresenterScreen({
  eventId,
  eventTitle,
  eventCode,
  joinUrl,
  participantCount,
  interactions,
  active,
  results,
  questions,
  quiz,
  leaderboard,
  survey,
}: {
  eventId: string;
  eventTitle: string;
  eventCode: string;
  joinUrl: string;
  participantCount: number;
  interactions: InteractionListItem[];
  active: InteractionDetail | null;
  results: InteractionResults | null;
  questions: QuestionItem[];
  quiz: QuizDetail | null;
  leaderboard: LeaderboardRow[];
  survey: SurveyDetail | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullscreen, setFullscreen] = useState(false);

  useEventSync(eventId, {
    channels: [channels.event(eventId), channels.qa(eventId), channels.quiz(eventId)],
  });

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      toast.error('Fullscreen was blocked by the browser.');
    }
  }

  const currentIndex = active
    ? interactions.findIndex((item) => item.id === active.id)
    : -1;

  function go(direction: -1 | 1) {
    const target =
      currentIndex === -1
        ? interactions[0]
        : interactions[currentIndex + direction];
    if (!target) return;

    startTransition(async () => {
      const result = await setInteractionStatusAction({
        interactionId: target.id,
        status: 'active',
      });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  const quizQuestion = quiz?.questions.find((q) => q.id === quiz.currentChildId) ?? null;
  const remaining = useCountdown(
    quizQuestion?.startedAt,
    quizQuestion?.settings.timeLimitSeconds ?? 20,
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border px-8 py-5">
        <Logo showWordmark={false} className="shrink-0" />
        <h1 className="min-w-0 flex-1 truncate text-xl font-medium text-muted-foreground">
          {eventTitle}
        </h1>

        <span className="inline-flex items-center gap-2 text-lg text-muted-foreground">
          <Users className="size-5" aria-hidden />
          <span className="tabular-nums">{participantCount}</span>
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
          <Link
            href={`/dashboard/events/${eventId}`}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Leave presenter mode"
          >
            <X className="size-5" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center px-8 py-8 lg:px-16">
        {!active ? (
          <div className="text-center">
            <p className="text-3xl text-muted-foreground">
              Nothing is open yet.
            </p>
            <p className="mt-3 text-xl text-muted-foreground">
              Join at <span className="text-foreground">{joinUrl.replace(/^https?:\/\//, '')}</span>
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-5xl">
            {quiz && quizQuestion ? (
              <>
                <div className="mb-6 flex items-center justify-between gap-6">
                  <p className="text-2xl text-muted-foreground">
                    Question{' '}
                    {quiz.questions.findIndex((q) => q.id === quizQuestion.id) + 1} of{' '}
                    {quiz.questions.length}
                  </p>
                  {remaining !== null && !quiz.answerRevealed && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-5 py-2 text-3xl font-semibold tabular-nums',
                        remaining <= 5
                          ? 'bg-destructive-subtle text-destructive'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      <Timer className="size-7" aria-hidden />
                      {remaining}
                    </span>
                  )}
                </div>

                <h2 className="text-5xl font-semibold leading-tight">
                  {quizQuestion.title}
                </h2>

                <ul className="mt-10 grid gap-4 sm:grid-cols-2">
                  {quizQuestion.options.map((option) => (
                    <li
                      key={option.id}
                      className={cn(
                        'rounded-xl border px-6 py-5 text-3xl',
                        quiz.answerRevealed && option.isCorrect
                          ? 'border-success bg-success-subtle text-success'
                          : 'border-border',
                      )}
                    >
                      {option.text}
                    </li>
                  ))}
                </ul>

                {quiz.answerRevealed && leaderboard.length > 0 && (
                  <div className="mt-10">
                    <h3 className="mb-4 text-2xl text-muted-foreground">Leaderboard</h3>
                    <Leaderboard rows={leaderboard} emphasis />
                  </div>
                )}
              </>
            ) : quiz ? (
              <div className="text-center">
                <h2 className="text-5xl font-semibold">{quiz.title}</h2>
                <p className="mt-4 text-2xl text-muted-foreground">
                  {quiz.status === 'closed' ? 'Final scores' : 'Get ready'}
                </p>
                <div className="mx-auto mt-10 max-w-3xl text-left">
                  <Leaderboard rows={leaderboard} emphasis />
                </div>
              </div>
            ) : active.type === 'q_and_a' ? (
              <>
                <h2 className="mb-8 text-4xl font-semibold">{active.title}</h2>
                {questions.length === 0 ? (
                  <p className="text-2xl text-muted-foreground">
                    No questions yet. Send yours from your phone.
                  </p>
                ) : (
                  <ul className="space-y-5">
                    {questions.map((question) => (
                      <li key={question.id} className="flex gap-6">
                        <span className="w-16 shrink-0 text-right text-4xl font-semibold tabular-nums text-primary">
                          {question.votes}
                        </span>
                        <div className="min-w-0">
                          <p className="text-3xl leading-snug">{question.text}</p>
                          <p className="mt-1 text-xl text-muted-foreground">
                            {question.authorName ?? 'Anonymous'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : survey ? (
              <>
                <h2 className="mb-8 text-4xl font-semibold">{survey.title}</h2>
                <p className="text-2xl text-muted-foreground">
                  {survey.completedCount} of {survey.startedCount} finished ·{' '}
                  {pluralize(survey.questions.length, 'question')}
                </p>
                <div className="mt-10 space-y-10">
                  {survey.questions.map((question) => (
                    <div key={question.id}>
                      <h3 className="mb-4 text-3xl font-medium">{question.title}</h3>
                      <ResultsView results={question.results} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-10 text-5xl font-semibold leading-tight">
                  {active.title}
                </h2>
                {results && <ResultsView results={results} emphasis />}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-white p-2">
            <QRCodeSVG value={joinUrl} size={84} level="M" />
          </div>
          <div>
            <p className="text-lg text-muted-foreground">Join at</p>
            <p className="text-xl font-medium">
              {joinUrl.replace(/^https?:\/\//, '').replace(/\/event\/.*$/, '')}
            </p>
            <p className="font-mono text-3xl font-semibold tracking-widest">
              {eventCode}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={pending || currentIndex <= 0}
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-lg hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-5" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={
              pending ||
              interactions.length === 0 ||
              currentIndex === interactions.length - 1
            }
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-lg text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
          >
            Next
            <ChevronRight className="size-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
