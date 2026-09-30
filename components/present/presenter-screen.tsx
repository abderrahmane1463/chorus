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
  Users,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Logo } from '@/components/shared/logo';
import { ResultsView } from '@/components/interactions/results-view';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { CountdownRing, useCountdown } from '@/components/quiz/countdown';
import { Podium } from '@/components/quiz/podium';
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

/**
 * How many of the room have answered the question on screen.
 *
 * The count comes from the server on every refresh, and each answer already
 * triggers one, so this climbs as the room taps without any polling.
 */
function AnswerProgress({ answered, total }: { answered: number; total: number }) {
  const t = useTranslations('presenter');
  const format = useFormatter();

  // Someone can answer and leave, or join mid-question, so never show more
  // than the whole room or divide by an empty one.
  const capped = Math.min(answered, total);
  const share = total === 0 ? 0 : (capped / total) * 100;
  const everyone = total > 0 && capped === total;

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between text-xl text-muted-foreground">
        <span className={cn(everyone && 'font-medium text-success')}>
          {everyone
            ? t('everyoneAnswered')
            : t('answered', {
                count: format.number(capped),
                total: format.number(total),
              })}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={capped}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className={cn(
            'bar-fill h-full rounded-full',
            everyone ? 'bg-success' : 'bg-primary',
          )}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
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
  serverNow,
}: {
  /** The server's clock when it rendered, so the timer ignores a wrong device clock. */
  serverNow: number;
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
  const t = useTranslations('presenter');
  const reduceMotion = useReducedMotion();
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
      toast.error(t('fullscreenBlocked'));
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
  const countdown = useCountdown(
    quizQuestion?.startedAt,
    quizQuestion?.settings.timeLimitSeconds ?? 20,
    serverNow,
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
            aria-label={fullscreen ? t('exitFullscreen') : t('enterFullscreen')}
          >
            {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
          <Link
            href={`/dashboard/events/${eventId}`}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('leave')}
          >
            <X className="size-5" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center px-8 py-8 lg:px-16">
        {!active ? (
          <div className="text-center">
            <p className="text-3xl text-muted-foreground">
              {t('nothingOpen')}
            </p>
            <p className="mt-3 text-xl text-muted-foreground">
              {t('joinAt')}{' '}
              <span dir="ltr" className="text-foreground">
                {joinUrl.replace(/^https?:\/\//, '')}
              </span>
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-5xl">
            {quiz && quizQuestion ? (
              <>
                <div className="mb-6 flex items-center justify-between gap-6">
                  <p className="text-2xl text-muted-foreground">
                    {t('questionOf', {
                      current:
                        quiz.questions.findIndex((q) => q.id === quizQuestion.id) + 1,
                      total: quiz.questions.length,
                    })}
                  </p>
                  {countdown && !quiz.answerRevealed && quizQuestion.startedAt && (
                    // Keyed on the question so the ring restarts from full
                    // when the host moves on, instead of carrying over.
                    <CountdownRing
                      key={quizQuestion.id}
                      startedAt={quizQuestion.startedAt}
                      limitSeconds={quizQuestion.settings.timeLimitSeconds ?? 20}
                      countdown={countdown}
                    />
                  )}
                </div>

                <h2 className="text-5xl font-semibold leading-tight">
                  {quizQuestion.title}
                </h2>

                <ul className="mt-10 grid gap-4 sm:grid-cols-2">
                  {quizQuestion.options.map((option) => {
                    const revealed = quiz.answerRevealed;
                    const correct = revealed && option.isCorrect;

                    return (
                      <motion.li
                        key={option.id}
                        // On reveal the right answer lifts and the rest fall
                        // back, so the eye lands on it from across the room.
                        animate={
                          reduceMotion
                            ? undefined
                            : {
                                scale: correct ? 1.03 : 1,
                                opacity: revealed && !correct ? 0.45 : 1,
                              }
                        }
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                        className={cn(
                          'rounded-xl border px-6 py-5 text-3xl transition-colors duration-300',
                          correct
                            ? 'border-success bg-success-subtle text-success'
                            : 'border-border',
                        )}
                      >
                        {option.text}
                      </motion.li>
                    );
                  })}
                </ul>

                {!quiz.answerRevealed && (
                  <AnswerProgress
                    answered={quizQuestion.answerCount}
                    total={participantCount}
                  />
                )}

                {quiz.answerRevealed && leaderboard.length > 0 && (
                  <div className="mt-10">
                    <h3 className="mb-4 text-2xl text-muted-foreground">{t('leaderboard')}</h3>
                    <Leaderboard rows={leaderboard} emphasis />
                  </div>
                )}
              </>
            ) : quiz ? (
              <div className="text-center">
                <h2 className="text-5xl font-semibold">{quiz.title}</h2>
                <p className="mt-4 text-2xl text-muted-foreground">
                  {quiz.status === 'closed' ? t('finalScores') : t('getReady')}
                </p>
                {quiz.status === 'closed' && leaderboard.length > 0 ? (
                  <>
                    <div className="mt-12">
                      <Podium rows={leaderboard} />
                    </div>
                    {/* Everyone below the podium still gets their place. */}
                    {leaderboard.length > 3 && (
                      <div className="mx-auto mt-10 max-w-3xl text-start">
                        <Leaderboard rows={leaderboard.slice(3)} emphasis />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mx-auto mt-10 max-w-3xl text-start">
                    <Leaderboard rows={leaderboard} emphasis />
                  </div>
                )}
              </div>
            ) : active.type === 'q_and_a' ? (
              <>
                <h2 className="mb-8 text-4xl font-semibold">{active.title}</h2>
                {questions.length === 0 ? (
                  <p className="text-2xl text-muted-foreground">
                    {t('noQuestions')}
                  </p>
                ) : (
                  <ul className="space-y-5">
                    {questions.map((question) => (
                      <li key={question.id} className="flex gap-6">
                        <span className="w-16 shrink-0 text-end text-4xl font-semibold tabular-nums text-primary">
                          {question.votes}
                        </span>
                        <div className="min-w-0">
                          <p className="text-3xl leading-snug">{question.text}</p>
                          <p className="mt-1 text-xl text-muted-foreground">
                            {question.authorName ?? t('anonymous')}
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
                  {t('surveyProgress', {
                    completed: survey.completedCount,
                    started: survey.startedCount,
                    questions: t('questionCount', { count: survey.questions.length }),
                  })}
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
            <p className="text-lg text-muted-foreground">{t('joinAt')}</p>
            <p dir="ltr" className="text-xl font-medium">
              {joinUrl.replace(/^https?:\/\//, '').replace(/\/event\/.*$/, '')}
            </p>
            <p dir="ltr" className="font-mono text-3xl font-semibold tracking-widest">
              {eventCode}
            </p>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={pending || currentIndex <= 0}
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-lg hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" />
            {t('previous')}
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
            {t('next')}
            <ChevronRight className="size-5 rtl:rotate-180" />
          </button>
        </div>
      </footer>
    </div>
  );
}
