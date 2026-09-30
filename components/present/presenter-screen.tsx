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
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Logo } from '@/components/shared/logo';
import { ResultsView } from '@/components/interactions/results-view';
import { QuizStage } from './quiz-stage';
import { useEventSync } from '@/hooks/use-event-sync';
import { channels } from '@/lib/realtime/events';
import { setInteractionStatusAction } from '@/lib/actions/interaction';
import type {
  InteractionDetail,
  InteractionListItem,
  InteractionResults,
} from '@/lib/queries/interactions';
import type { QuestionItem } from '@/lib/queries/questions';
import type { LeaderboardRow, LobbyPlayer, QuizDetail } from '@/lib/queries/quiz';
import type { QuizPhase } from '@/lib/quiz/pacing';
import type { SurveyDetail } from '@/lib/queries/survey';

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
  players,
  quizPhase,
  quizDueAt,
}: {
  /** Who has joined, for the quiz lobby. */
  players: LobbyPlayer[];
  quizPhase: QuizPhase;
  /** When the quiz next moves on by itself (epoch ms), or null if it waits for the host. */
  quizDueAt: number | null;
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

  // The lobby shows its own large code, so the footer's copy would only
  // repeat it a few centimetres lower.
  const inLobby = Boolean(quiz) && quizPhase === 'lobby';

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
            {quiz ? (
              <QuizStage
                quiz={quiz}
                phase={quizPhase}
                dueAt={quizDueAt}
                leaderboard={leaderboard}
                players={players}
                playerTotal={participantCount}
                joinUrl={joinUrl}
                eventCode={eventCode}
                serverNow={serverNow}
              />
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
        <div className={inLobby ? 'invisible flex items-center gap-4' : 'flex items-center gap-4'}>
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
