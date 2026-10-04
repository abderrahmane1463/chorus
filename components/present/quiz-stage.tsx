'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Check, LogOut, Play, RotateCcw, Users, Volume2, VolumeX } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { TileLetter, tileFor } from '@/components/quiz/answer-tiles';
import { CountdownRing, useCountdown, useSecondsUntil } from '@/components/quiz/countdown';
import { Podium } from '@/components/quiz/podium';
import { PlayerChip } from '@/components/quiz/player-chip';
import { useQuizPacer } from '@/hooks/use-quiz-pacer';
import { useQuizSounds } from '@/hooks/use-quiz-sounds';
import { controlQuizAction } from '@/lib/actions/quiz';
import type { LeaderboardRow, LobbyPlayer, QuizDetail, QuizQuestion } from '@/lib/queries/quiz';
import { ANSWER_VIEW_SECONDS, type QuizPhase } from '@/lib/quiz/pacing';
import { cn } from '@/lib/utils/cn';

const SOUND_PREFERENCE = 'chorus_quiz_sound';
const SCOREBOARD_SIZE = 5;

/**
 * The projector's view of a quiz, one screen per phase of the run:
 * lobby, get ready, question, what the room picked, scoreboard, podium.
 */
export function QuizStage({
  quiz,
  phase,
  dueAt,
  leaderboard,
  players,
  playerTotal,
  joinUrl,
  eventCode,
  serverNow,
}: {
  quiz: QuizDetail;
  phase: QuizPhase;
  /** When the quiz next moves on by itself (epoch ms), or null if it waits for the host. */
  dueAt: number | null;
  leaderboard: LeaderboardRow[];
  players: LobbyPlayer[];
  playerTotal: number;
  joinUrl: string;
  eventCode: string;
  serverNow: number;
}) {
  const t = useTranslations('presenter');
  const format = useFormatter();
  const reduceMotion = useReducedMotion();
  const [soundOn, setSoundOn] = useSoundPreference();

  const index = quiz.questions.findIndex((q) => q.id === quiz.currentChildId);
  const question = quiz.questions[index] ?? null;
  const limitSeconds = question?.settings.timeLimitSeconds ?? 20;

  const countdown = useCountdown(question?.startedAt, limitSeconds, serverNow);
  const nextIn = useSecondsUntil(phase === 'revealed' ? dueAt : null, serverNow);

  // The server's time when this screen first showed the answer to the current
  // question. The reveal reaches a screen a moment after it is stamped, and on
  // a slow connection that moment is seconds, so the pause is split from here
  // and not from the stamp: otherwise the lag comes out of the answer view
  // alone and the room barely sees what it picked.
  const [seenReveal, setSeenReveal] = useState<{ questionId: string; at: number } | null>(null);
  const revealedId = phase === 'revealed' ? (question?.id ?? null) : null;
  if (revealedId !== (seenReveal?.questionId ?? null)) {
    setSeenReveal(revealedId ? { questionId: revealedId, at: serverNow } : null);
  }

  // With automatic pacing the answer pause is split: first what the room
  // picked, then the scoreboard. Paced by hand there is no clock to split,
  // so both are shown together and the host moves on when ready.
  const scoreboardAt =
    seenReveal && dueAt !== null
      ? seenReveal.at +
        Math.min(ANSWER_VIEW_SECONDS * 1000, Math.max(0, dueAt - seenReveal.at) / 2)
      : null;
  const untilScoreboard = useSecondsUntil(scoreboardAt, serverNow);

  const finished = !question && quiz.status === 'closed' && leaderboard.length > 0;

  // The projector is the screen the room is watching, so it is the one that
  // asks ahead of each deadline.
  useQuizPacer({ quizId: quiz.id, dueAt, serverNow, role: 'stage' });

  useQuizSounds({
    enabled: soundOn,
    phase,
    startsIn: countdown?.startsIn ?? null,
    remaining: countdown?.remaining ?? null,
    playerCount: playerTotal,
    onPodium: finished,
  });

  const soundToggle = (
    <button
      type="button"
      onClick={() => setSoundOn(!soundOn)}
      aria-pressed={soundOn}
      aria-label={soundOn ? t('soundOff') : t('soundOn')}
      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {soundOn ? <Volume2 className="size-6" /> : <VolumeX className="size-6" />}
    </button>
  );

  if (phase === 'lobby') {
    return (
      <Lobby
        quiz={quiz}
        players={players}
        playerTotal={playerTotal}
        joinUrl={joinUrl}
        eventCode={eventCode}
        soundToggle={soundToggle}
      />
    );
  }

  if (!question) {
    return (
      <div className="text-center">
        <h2 className="text-5xl font-semibold">{quiz.title}</h2>
        <p className="mt-4 text-2xl text-muted-foreground">{t('finalScores')}</p>
        {finished ? (
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
        {quiz.status === 'closed' && <AfterPodium quiz={quiz} />}
      </div>
    );
  }

  const position = t('questionOf', { current: index + 1, total: quiz.questions.length });

  // Until the clock has ticked once it is not known whether the question has
  // opened, so the answers stay hidden rather than flash up for a moment
  // before "get ready" replaces them.
  const gettingReady = phase === 'question' && (countdown === null || countdown.startsIn > 0);

  if (gettingReady) {
    return (
      <div className="text-center">
        <p className="text-2xl text-muted-foreground">{position}</p>
        {/* The question is readable now; the answers wait for the clock, so
            nobody is tapping before they have finished reading. */}
        <h2 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-tight">
          <bdi>{question.title}</bdi>
        </h2>
        <p className="mt-12 text-2xl text-muted-foreground">{t('getReady')}</p>
        <p
          // Keyed on the number so each second makes its own small entrance.
          key={countdown?.startsIn ?? 'pending'}
          className={cn(
            'mt-2 text-8xl font-semibold tabular-nums text-primary',
            !reduceMotion && 'countdown-urgent',
          )}
        >
          {/* A dash for the instant before the first tick. */}
          {countdown ? format.number(countdown.startsIn) : '–'}
        </p>
      </div>
    );
  }

  const revealed = phase === 'revealed';
  const last = index === quiz.questions.length - 1;
  const showScoreboard = revealed && scoreboardAt !== null && untilScoreboard === 0;
  const showBoth = revealed && scoreboardAt === null;

  const header = (
    <div className="mb-6 flex items-center justify-between gap-6">
      <p className="text-2xl text-muted-foreground">{position}</p>
      <div className="flex items-center gap-4">
        {revealed && nextIn !== null && (
          <p className="text-2xl text-muted-foreground" role="timer" aria-live="off">
            {last
              ? t('resultsIn', { seconds: format.number(nextIn) })
              : t('nextIn', { seconds: format.number(nextIn) })}
          </p>
        )}
        {soundToggle}
        {countdown && !revealed && question.startedAt && (
          // Keyed on the question so the ring restarts from full each time.
          <CountdownRing
            key={question.id}
            startedAt={question.startedAt}
            limitSeconds={limitSeconds}
            countdown={countdown}
          />
        )}
      </div>
    </div>
  );

  if (showScoreboard) {
    return (
      <>
        {header}
        <h2 className="text-4xl font-semibold">{t('scoreboard')}</h2>
        <CorrectLine question={question} />
        <div className="mt-8">
          <Leaderboard rows={leaderboard.slice(0, SCOREBOARD_SIZE)} emphasis />
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <h2 className="text-5xl font-semibold leading-tight"><bdi>{question.title}</bdi></h2>

      {revealed && <PicksChart question={question} />}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {question.options.map((option, optionIndex) => {
          const correct = revealed && option.isCorrect;

          return (
            <motion.li
              key={option.id}
              // On reveal the right answer lifts and the rest fall back, so
              // the eye lands on it from across the room.
              animate={
                reduceMotion
                  ? undefined
                  : {
                      scale: correct ? 1.03 : 1,
                      opacity: revealed && !correct ? 0.35 : 1,
                    }
              }
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={cn(
                'flex items-center gap-5 rounded-2xl px-6 py-5 text-3xl font-medium text-white',
                tileFor(optionIndex).surface,
                revealed && !correct && reduceMotion && 'opacity-35',
              )}
            >
              <TileLetter index={optionIndex} size="lg" />
              <bdi className="min-w-0 flex-1">{option.text}</bdi>
              {correct && <Check className="size-10 shrink-0" aria-label={t('correct')} />}
            </motion.li>
          );
        })}
      </ul>

      {!revealed && <AnswerProgress answered={question.answerCount} total={playerTotal} />}

      {showBoth && leaderboard.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 text-2xl text-muted-foreground">{t('leaderboard')}</h3>
          <Leaderboard rows={leaderboard.slice(0, SCOREBOARD_SIZE)} emphasis />
        </div>
      )}
    </>
  );
}

const SOUND_CHANGED = 'chorus:quiz-sound';

/** The choice for this visit, used when the browser will not store it. */
let soundForThisVisit: boolean | null = null;

function readSound(): boolean {
  if (soundForThisVisit !== null) return soundForThisVisit;
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE) !== 'off';
  } catch {
    // Storage can be blocked; sound simply stays on for this visit.
    return true;
  }
}

function subscribeToSound(onChange: () => void): () => void {
  // `storage` fires when another tab changes it; the custom event covers this one.
  window.addEventListener('storage', onChange);
  window.addEventListener(SOUND_CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SOUND_CHANGED, onChange);
  };
}

/**
 * Whether the projector plays sound, remembered on this device.
 *
 * Read as an external store rather than copied into state: the server cannot
 * see the saved choice, so it renders "on" and the browser corrects it
 * without a mismatch.
 */
function useSoundPreference(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeToSound, readSound, () => true);

  const update = (next: boolean) => {
    soundForThisVisit = next;
    try {
      window.localStorage.setItem(SOUND_PREFERENCE, next ? 'on' : 'off');
    } catch {
      // Not remembered, but it still applies now.
    }
    window.dispatchEvent(new Event(SOUND_CHANGED));
  };

  return [on, update];
}

/** One line naming the right answer, for the scoreboard screen. */
function CorrectLine({ question }: { question: QuizQuestion }) {
  const t = useTranslations('presenter');
  const correct = question.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.isCorrect);

  return (
    <p className="mt-3 flex flex-wrap items-center gap-3 text-2xl text-muted-foreground">
      {t('correctAnswer', { count: correct.length })}
      {correct.map(({ option, index }) => (
        <span
          key={option.id}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xl font-medium text-white',
            tileFor(index).surface,
          )}
        >
          <TileLetter index={index} className="size-7 text-base" />
          <bdi>{option.text}</bdi>
        </span>
      ))}
    </p>
  );
}

/**
 * How the room answered: one bar per option, in that option's colour.
 *
 * Heights are relative to the most-picked option, not to the room, so the
 * shape of the vote is readable even when only a few people answered.
 */
function PicksChart({ question }: { question: QuizQuestion }) {
  const t = useTranslations('presenter');
  const format = useFormatter();
  const reduceMotion = useReducedMotion();
  const most = Math.max(1, ...question.options.map((option) => option.picks));

  return (
    // A chart reads left to right in every language; the letters under the
    // bars tie it to the tiles below.
    <div dir="ltr" className="mt-8 flex h-44 items-end justify-center gap-6">
      {question.options.map((option, index) => (
        <div key={option.id} className="flex h-full w-24 flex-col items-center">
          <span
            className="mb-2 inline-flex items-center gap-1 text-2xl font-semibold tabular-nums"
            aria-label={t('picked', { count: option.picks })}
          >
            {option.isCorrect && <Check className="size-6 text-success" aria-hidden />}
            {format.number(option.picks)}
          </span>
          {/* The bar grows inside its own track. Sized against the whole
              column it would be squeezed by the count and the letter, and the
              tallest bar would lose more than the others. */}
          <div className="flex min-h-0 w-full flex-1 items-end">
            <motion.div
              initial={reduceMotion ? false : { height: '4%' }}
              animate={{ height: `${Math.max(4, (option.picks / most) * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'w-full rounded-t-lg',
                tileFor(index).chart,
                !option.isCorrect && 'opacity-45',
              )}
              style={
                reduceMotion
                  ? { height: `${Math.max(4, (option.picks / most) * 100)}%` }
                  : undefined
              }
            />
          </div>
          <TileLetter
            index={index}
            className={cn('mt-2 rounded-md text-base', tileFor(index).surface)}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Before the first question: how to join, and who already has.
 *
 * Nothing is timed here. The room fills at its own pace and the host starts
 * when it looks ready.
 */
function Lobby({
  quiz,
  players,
  playerTotal,
  joinUrl,
  eventCode,
  soundToggle,
}: {
  quiz: QuizDetail;
  players: LobbyPlayer[];
  playerTotal: number;
  joinUrl: string;
  eventCode: string;
  soundToggle: React.ReactNode;
}) {
  const t = useTranslations('presenter');
  const reduceMotion = useReducedMotion();
  const [starting, startTransition] = useTransition();

  const hidden = playerTotal - players.length;
  const empty = quiz.questions.length === 0;

  function start() {
    startTransition(async () => {
      const result = await controlQuizAction({ quizId: quiz.id, action: 'start' });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[auto_1fr]">
      <div className="mx-auto text-center">
        <div className="inline-block rounded-2xl bg-white p-4">
          <QRCodeSVG value={joinUrl} size={260} level="M" />
        </div>
        <p className="mt-5 text-xl text-muted-foreground">{t('joinAt')}</p>
        <p dir="ltr" className="text-2xl font-medium">
          {joinUrl.replace(/^https?:\/\//, '').replace(/\/event\/.*$/, '')}
        </p>
        <p dir="ltr" className="mt-1 font-mono text-5xl font-semibold tracking-widest">
          {eventCode}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-5xl font-semibold leading-tight">{quiz.title}</h2>
          {soundToggle}
        </div>

        <p className="mt-5 inline-flex items-center gap-2 text-2xl text-muted-foreground">
          <Users className="size-6" aria-hidden />
          {/* aria-live so a screen reader hears the room filling. */}
          <span aria-live="polite">{t('playersJoined', { count: playerTotal })}</span>
        </p>

        <ul className="mt-6 flex max-h-72 flex-wrap gap-2.5 overflow-hidden">
          {/* initial={false}: the names already here on load simply appear;
              only the ones that join while the room watches pop in. */}
          <AnimatePresence initial={false}>
            {players.map((player) => (
              <motion.li
                key={player.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              >
                <PlayerChip player={player} size="lg" />
              </motion.li>
            ))}
          </AnimatePresence>
          {hidden > 0 && (
            <li className="rounded-full px-4 py-2 text-xl text-muted-foreground">
              {t('morePlayers', { count: hidden })}
            </li>
          )}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={start}
            // Locked until someone is in the room: the host watches the names
            // arrive, then starts.
            disabled={starting || empty || playerTotal === 0}
            className="inline-flex items-center gap-3 rounded-xl bg-primary px-8 py-4 text-2xl font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <Play className="size-6" aria-hidden />
            {t('startQuiz')}
          </button>
          <p className="text-lg text-muted-foreground">
            {empty
              ? t('noQuestionsYet')
              : playerTotal === 0
                ? t('startNeedsPlayer')
                : t('startHint')}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The host's two ways on from the podium: run the quiz again, or leave.
 *
 * Nothing here is timed. The final standings stay up until the host decides.
 */
function AfterPodium({ quiz }: { quiz: QuizDetail }) {
  const t = useTranslations('presenter');
  const [restarting, startTransition] = useTransition();

  function playAgain() {
    startTransition(async () => {
      // Clears the scores and reopens the lobby; the players stay joined.
      const result = await controlQuizAction({ quizId: quiz.id, action: 'restart' });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
      <button
        type="button"
        onClick={playAgain}
        disabled={restarting}
        className="inline-flex items-center gap-3 rounded-xl bg-primary px-8 py-4 text-2xl font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        <RotateCcw className="size-6" aria-hidden />
        {t('playAgain')}
      </button>
      <Link
        href={`/dashboard/events/${quiz.eventId}`}
        className="inline-flex items-center gap-3 rounded-xl border border-border px-8 py-4 text-2xl font-semibold transition-colors hover:bg-muted"
      >
        <LogOut className="size-6 rtl:rotate-180" aria-hidden />
        {t('exit')}
      </Link>
    </div>
  );
}

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
          className={cn('bar-fill h-full rounded-full', everyone ? 'bg-success' : 'bg-primary')}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}
