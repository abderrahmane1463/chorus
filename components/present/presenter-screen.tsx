'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
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
import { controlQuizAction } from '@/lib/actions/quiz';
import type {
  InteractionDetail,
  InteractionListItem,
  InteractionResults,
} from '@/lib/queries/interactions';
import type { QuestionItem } from '@/lib/queries/questions';
import type { LeaderboardRow, LobbyPlayer, QuizDetail } from '@/lib/queries/quiz';
import type { QuizPhase } from '@/lib/quiz/pacing';
import type { SurveyDetail } from '@/lib/queries/survey';
import { BrandLogo, BrandStyle, PartnerLogos } from '@/components/branding/brand';
import { assetUrl } from '@/lib/branding/templates';
import { cn } from '@/lib/utils/cn';
import type { EventBranding } from '@/types/branding';

type QuizStep = 'start' | 'reveal' | 'next' | 'finish';

const QUIZ_STEP_LABELS = {
  start: 'startQuiz',
  reveal: 'revealAnswer',
  next: 'nextQuestion',
  finish: 'showResults',
} as const satisfies Record<QuizStep, string>;

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
  branding,
}: {
  /** The event's own design, or null for the Chorus look. */
  branding: EventBranding | null;
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

  /**
   * What Next does while a quiz is on screen: the quiz's own next step, not
   * the next activity. Paced by hand, this button is how the host runs the
   * whole quiz from the big screen; paced automatically, it skips ahead.
   */
  const quizIndex = quiz ? quiz.questions.findIndex((q) => q.id === quiz.currentChildId) : -1;
  const quizStep: QuizStep | null = !quiz
    ? null
    : quizPhase === 'lobby'
      ? 'start'
      : quizPhase === 'question'
        ? 'reveal'
        : quizPhase === 'revealed'
          ? quizIndex === quiz.questions.length - 1
            ? 'finish'
            : 'next'
          : null;

  function forward() {
    if (quiz && quizStep) {
      startTransition(async () => {
        const result = await controlQuizAction({ quizId: quiz.id, action: quizStep });
        if (result.ok) router.refresh();
        else toast.error(result.error);
      });
      return;
    }
    go(1);
  }

  // Leaving a quiz while it runs would close it mid-question, so Previous
  // waits until it is over.
  const canGoBack = !pending && !quizStep && currentIndex > 0;
  const canGoForward =
    !pending &&
    (quizStep !== null || (interactions.length > 0 && currentIndex < interactions.length - 1));

  // A presentation clicker sends Page Down and Page Up; arrow keys work too.
  // Read through a ref, so the listener always acts on the current step.
  const keys = useRef({ forward, back: () => go(-1), canGoForward, canGoBack });
  useEffect(() => {
    keys.current = { forward, back: () => go(-1), canGoForward, canGoBack };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // Space and Enter already press a focused button; acting again would
      // take two steps for one press.
      const onControl = Boolean(target?.closest('button, a'));

      const { forward: next, back, canGoForward: canNext, canGoBack: canBack } = keys.current;
      if (
        ['PageDown', 'ArrowRight', 'ArrowDown'].includes(event.key) ||
        ([' ', 'Enter'].includes(event.key) && !onControl)
      ) {
        if (!canNext) return;
        event.preventDefault();
        next();
      } else if (['PageUp', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
        if (!canBack) return;
        event.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const backdrop = branding?.backgroundId ? assetUrl(branding.backgroundId) : null;

  // The lobby shows its own large code, so the footer's copy would only
  // repeat it a few centimetres lower.
  const inLobby = Boolean(quiz) && quizPhase === 'lobby';

  return (
    <div
      className={cn(
        // `isolate` keeps the backdrop's veil behind the content and nothing else.
        'relative isolate flex min-h-dvh flex-col bg-background',
        branding && !backdrop && 'brand-backdrop',
      )}
      style={
        backdrop
          ? {
              backgroundImage: `url(${backdrop})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <BrandStyle branding={branding} />
      {backdrop && (
        // A veil in the page colour: the picture sets the mood, and the
        // question still has to be read from the back of the room.
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-background/80" />
      )}

      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border px-8 py-5">
        <BrandLogo
          branding={branding}
          title={eventTitle}
          className="h-11 max-w-44 shrink-0"
          fallback={<Logo showWordmark={false} className="shrink-0" />}
        />
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

        <PartnerLogos branding={branding} className="mx-auto justify-center" logoClassName="h-12" />

        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={!canGoBack}
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-lg hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" />
            {t('previous')}
          </button>
          <button
            type="button"
            onClick={forward}
            disabled={!canGoForward}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-lg text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
          >
            {quizStep ? t(QUIZ_STEP_LABELS[quizStep]) : t('next')}
            <ChevronRight className="size-5 rtl:rotate-180" />
          </button>
        </div>
      </footer>
    </div>
  );
}
