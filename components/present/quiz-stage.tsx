'use client';

import { useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import { Play, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { CountdownRing, useCountdown, useSecondsUntil } from '@/components/quiz/countdown';
import { Podium } from '@/components/quiz/podium';
import { useQuizPacer } from '@/hooks/use-quiz-pacer';
import { controlQuizAction } from '@/lib/actions/quiz';
import type { LeaderboardRow, LobbyPlayer, QuizDetail } from '@/lib/queries/quiz';
import type { QuizPhase } from '@/lib/quiz/pacing';
import { cn } from '@/lib/utils/cn';

/**
 * The projector's view of a quiz, one screen per phase of the run:
 * lobby, get ready, question, answer, and final standings.
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

  const index = quiz.questions.findIndex((q) => q.id === quiz.currentChildId);
  const question = quiz.questions[index] ?? null;
  const limitSeconds = question?.settings.timeLimitSeconds ?? 20;

  const countdown = useCountdown(question?.startedAt, limitSeconds, serverNow);
  const nextIn = useSecondsUntil(phase === 'revealed' ? dueAt : null, serverNow);

  // The projector is the screen the room is watching, so it is the one that
  // asks ahead of each deadline.
  useQuizPacer({ quizId: quiz.id, dueAt, serverNow, role: 'stage' });

  if (phase === 'lobby') {
    return (
      <Lobby
        quiz={quiz}
        players={players}
        playerTotal={playerTotal}
        joinUrl={joinUrl}
        eventCode={eventCode}
      />
    );
  }

  if (!question) {
    const finished = quiz.status === 'closed' && leaderboard.length > 0;

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
          {question.title}
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

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-6">
        <p className="text-2xl text-muted-foreground">{position}</p>
        {countdown && !revealed && question.startedAt && (
          // Keyed on the question so the ring restarts from full each time.
          <CountdownRing
            key={question.id}
            startedAt={question.startedAt}
            limitSeconds={limitSeconds}
            countdown={countdown}
          />
        )}
        {revealed && nextIn !== null && (
          <p className="text-2xl text-muted-foreground" role="timer" aria-live="off">
            {last
              ? t('resultsIn', { seconds: format.number(nextIn) })
              : t('nextIn', { seconds: format.number(nextIn) })}
          </p>
        )}
      </div>

      <h2 className="text-5xl font-semibold leading-tight">{question.title}</h2>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {question.options.map((option) => {
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
                      opacity: revealed && !correct ? 0.45 : 1,
                    }
              }
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={cn(
                'flex items-center justify-between gap-4 rounded-xl border px-6 py-5 text-3xl transition-colors duration-300',
                correct ? 'border-success bg-success-subtle text-success' : 'border-border',
              )}
            >
              <span className="min-w-0">{option.text}</span>
              {revealed && (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 text-2xl tabular-nums"
                  aria-label={t('picked', { count: option.picks })}
                >
                  <Users className="size-5" aria-hidden />
                  {format.number(option.picks)}
                </span>
              )}
            </motion.li>
          );
        })}
      </ul>

      {!revealed && <AnswerProgress answered={question.answerCount} total={playerTotal} />}

      {revealed && leaderboard.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 text-2xl text-muted-foreground">{t('leaderboard')}</h3>
          <Leaderboard rows={leaderboard} emphasis />
        </div>
      )}
    </>
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
}: {
  quiz: QuizDetail;
  players: LobbyPlayer[];
  playerTotal: number;
  joinUrl: string;
  eventCode: string;
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
        <h2 className="text-5xl font-semibold leading-tight">{quiz.title}</h2>

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
                // dir="auto": an Arabic name reads right to left on an
                // English screen, and the other way round.
                dir="auto"
                className="rounded-full border border-border bg-card px-4 py-2 text-xl font-medium"
              >
                {player.displayName ?? t('anonymous')}
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
            disabled={starting || empty}
            className="inline-flex items-center gap-3 rounded-xl bg-primary px-8 py-4 text-2xl font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <Play className="size-6" aria-hidden />
            {t('startQuiz')}
          </button>
          <p className="text-lg text-muted-foreground">
            {empty ? t('noQuestionsYet') : t('startHint')}
          </p>
        </div>
      </div>
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
