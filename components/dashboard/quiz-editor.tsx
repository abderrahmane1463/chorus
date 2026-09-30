'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import {
  Check,
  DoorOpen,
  Eye,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { Leaderboard } from '@/components/interactions/leaderboard';
import {
  addQuizQuestionAction,
  controlQuizAction,
  deleteQuizQuestionAction,
  saveQuizQuestionAction,
} from '@/lib/actions/quiz';
import type { LeaderboardRow, QuizDetail, QuizQuestion } from '@/lib/queries/quiz';
import { quizPacing, type QuizPhase } from '@/lib/quiz/pacing';
import { useQuizPacer } from '@/hooks/use-quiz-pacer';
import { cn } from '@/lib/utils/cn';

export function QuizEditor({
  quiz,
  leaderboard,
  phase,
  dueAt,
  playerCount,
  serverNow,
}: {
  quiz: QuizDetail;
  leaderboard: LeaderboardRow[];
  phase: QuizPhase;
  /** When the quiz next moves on by itself (epoch ms), or null if it waits for the host. */
  dueAt: number | null;
  /** Everyone who has joined the event. */
  playerCount: number;
  serverNow: number;
}) {
  const router = useRouter();
  const t = useTranslations('quizEditor');
  const [pending, startTransition] = useTransition();

  const currentIndex = quiz.questions.findIndex((q) => q.id === quiz.currentChildId);
  const isLast = currentIndex === quiz.questions.length - 1;
  const automatic = quizPacing(quiz.settings).autoAdvance;
  const inQuestion = phase === 'question' || phase === 'revealed';

  // The host's dashboard keeps the quiz moving too, so a run does not depend
  // on the projector tab staying open. It asks after the projector would.
  useQuizPacer({ quizId: quiz.id, dueAt, serverNow, role: 'backup' });

  function control(action: string, message: string) {
    startTransition(async () => {
      const result = await controlQuizAction({ quizId: quiz.id, action });
      if (result.ok) {
        toast.success(message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const questionsCardRef = useRef<HTMLDivElement>(null);

  function addQuestion({ reveal = false }: { reveal?: boolean } = {}) {
    startTransition(async () => {
      const result = await addQuizQuestionAction({ quizId: quiz.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();

      // Asked for from the top of the page, the new form opens further down,
      // so bring it to the host instead of leaving them to look for it.
      if (reveal) {
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        questionsCardRef.current?.scrollIntoView({
          behavior: calm ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    });
  }

  const empty = quiz.questions.length === 0;

  const runCard = (
    <Card>
        <CardHeader>
          <CardTitle>{t('run')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(phase === 'idle' || phase === 'finished') && (
              <Button onClick={() => control('open', t('lobbyOpened'))} loading={pending} disabled={empty}>
                <DoorOpen />
                {t('openLobby')}
              </Button>
            )}

            {phase === 'lobby' && (
              <Button onClick={() => control('start', t('started'))} loading={pending} disabled={empty}>
                <Play />
                {t('start')}
              </Button>
            )}

            {/* Overrides. With automatic pacing these only skip ahead; without
                it they are how the quiz moves at all. */}
            {phase === 'question' && (
              <Button
                variant={automatic ? 'secondary' : 'primary'}
                onClick={() => control('reveal', t('revealed'))}
                loading={pending}
              >
                <Eye />
                {automatic ? t('revealNow') : t('reveal')}
              </Button>
            )}
            {phase === 'revealed' && !isLast && (
              <Button
                variant={automatic ? 'secondary' : 'primary'}
                onClick={() => control('next', t('nextDone'))}
                loading={pending}
              >
                <SkipForward />
                {automatic ? t('nextNow') : t('next')}
              </Button>
            )}
            {(inQuestion || phase === 'lobby') && (
              <Button
                variant="secondary"
                onClick={() => control('finish', t('finished'))}
                loading={pending}
              >
                <Square />
                {phase === 'lobby' ? t('closeLobby') : t('finish')}
              </Button>
            )}

            <Button
              variant="destructive"
              onClick={() => control('restart', t('restarted'))}
              disabled={pending || empty}
              className="ms-auto"
            >
              <RotateCcw />
              {t('restart')}
            </Button>
          </div>

          {!empty && (phase === 'idle' || phase === 'finished') && (
            <p className="text-sm text-muted-foreground">{t('lobbyHint')}</p>
          )}
          {phase === 'lobby' && (
            <p className="text-sm text-muted-foreground">
              {t('inLobby', { count: playerCount })} {t('startHint')}
            </p>
          )}
          {inQuestion && (
            <p className="text-sm text-muted-foreground">
              {t('showing', { current: currentIndex + 1, total: quiz.questions.length })}
              {quiz.answerRevealed ? t('answerRevealed') : ''}
              {automatic ? ' · ' + t('automatic') : ''}
            </p>
          )}
          {empty && (
            // The first thing a new quiz needs, offered where the host is
            // looking rather than only in the card below.
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-accent-subtle px-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm text-accent">{t('needQuestion')}</p>
              <Button size="sm" onClick={() => addQuestion({ reveal: true })} loading={pending}>
                <Plus />
                {t('addFirst')}
              </Button>
            </div>
          )}
        </CardContent>
    </Card>
  );

  const questionsCard = (
    <Card>
        <CardHeader>
          <CardTitle>
            {t('questions')}{' '}
            <span className="font-normal text-muted-foreground">
              ({quiz.questions.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quiz.questions.length === 0 ? (
            <EmptyState
              title={t('noneTitle')}
              description={t('noneBody')}
            />
          ) : (
            quiz.questions.map((question, index) => (
              <QuizQuestionEditor
                key={question.id}
                question={question}
                index={index}
                isCurrent={question.id === quiz.currentChildId}
              />
            ))
          )}

          <Button variant="secondary" onClick={() => addQuestion()} loading={pending}>
            <Plus />
            {t('addQuestion')}
          </Button>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      {/* A fixed order. Swapping these when the first question arrived moved
          the form the host was about to fill in, so the cards stay put and
          the run card points the way instead. */}
      {runCard}
      {/* scroll-mt keeps the card clear of the top edge when scrolled to. */}
      <div ref={questionsCardRef} className="scroll-mt-6">
        {questionsCard}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('leaderboard')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Leaderboard rows={leaderboard} />
        </CardContent>
      </Card>
    </div>
  );
}

type OptionDraft = { id?: string; text: string; isCorrect: boolean };

function QuizQuestionEditor({
  question,
  index,
  isCurrent,
}: {
  question: QuizQuestion;
  index: number;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('quizEditor');
  const [open, setOpen] = useState(question.title.trim().length === 0);
  const [title, setTitle] = useState(question.title);
  const [timeLimit, setTimeLimit] = useState(question.settings.timeLimitSeconds ?? 20);
  const [points, setPoints] = useState(question.settings.points ?? 1000);
  const [speedBonus, setSpeedBonus] = useState(question.settings.speedBonus ?? true);
  const [explanation, setExplanation] = useState(question.settings.explanation ?? '');
  const [options, setOptions] = useState<OptionDraft[]>(
    question.options.map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
    })),
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveQuizQuestionAction({
        questionId: question.id,
        title,
        timeLimitSeconds: timeLimit,
        points,
        speedBonus,
        explanation,
        options,
      });
      if (result.ok) {
        toast.success(t('saved'));
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteQuizQuestionAction({ questionId: question.id });
      if (result.ok) {
        toast.success(t('deleted'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        isCurrent ? 'border-primary bg-primary-subtle' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-w-0 flex-1 text-start"
        >
          <span className="text-xs text-muted-foreground">
            {t('questionNumber', { number: index + 1 })}
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate font-medium',
              !title && 'italic text-muted-foreground',
            )}
          >
            {title || t('untitled')}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t('summary', {
              seconds: timeLimit,
              points,
              answers: t('answerCount', { count: question.answerCount }),
            })}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {isCurrent && <Badge variant="success">{t('onScreen')}</Badge>}
          <Button variant="ghost" size="icon" onClick={remove} aria-label={t('deleteQuestion')}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`q-${question.id}`}>{t('question')}</Label>
            <Input
              id={`q-${question.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              placeholder={t('questionPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('answersLabel')}</Label>
            {options.map((option, optionIndex) => (
              <div key={option.id ?? `new-${optionIndex}`} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={option.isCorrect ? t('markedCorrect') : t('markCorrect')}
                  aria-pressed={option.isCorrect}
                  onClick={() =>
                    setOptions(
                      options.map((o, i) =>
                        i === optionIndex ? { ...o, isCorrect: !o.isCorrect } : o,
                      ),
                    )
                  }
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors',
                    option.isCorrect
                      ? 'border-success bg-success-subtle text-success'
                      : 'border-border text-muted-foreground hover:border-success',
                  )}
                >
                  <Check className="size-4" />
                </button>
                <Input
                  value={option.text}
                  onChange={(event) =>
                    setOptions(
                      options.map((o, i) =>
                        i === optionIndex ? { ...o, text: event.target.value } : o,
                      ),
                    )
                  }
                  maxLength={160}
                  placeholder={t('answerPlaceholder', { number: optionIndex + 1 })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={options.length <= 2}
                  onClick={() => setOptions(options.filter((_, i) => i !== optionIndex))}
                  aria-label={t('removeAnswer', { number: optionIndex + 1 })}
                >
                  <X />
                </Button>
              </div>
            ))}
            {options.length < 6 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOptions([...options, { text: '', isCorrect: false }])}
              >
                <Plus />
                {t('addAnswer')}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`t-${question.id}`}>{t('timeLimit')}</Label>
              <Input
                id={`t-${question.id}`}
                type="number"
                min={5}
                max={180}
                value={timeLimit}
                onChange={(event) => setTimeLimit(Number(event.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`p-${question.id}`}>{t('points')}</Label>
              <Input
                id={`p-${question.id}`}
                type="number"
                min={100}
                max={5000}
                step={100}
                value={points}
                onChange={(event) => setPoints(Number(event.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="font-medium">{t('speedBonus')}</span>
              <span className="block text-xs text-muted-foreground">
                {t('speedBonusHint')}
              </span>
            </span>
            <Switch checked={speedBonus} onCheckedChange={setSpeedBonus} />
          </label>

          <div className="space-y-1.5">
            <Label htmlFor={`e-${question.id}`}>{t('explanation')}</Label>
            <Input
              id={`e-${question.id}`}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              maxLength={300}
              placeholder={t('explanationPlaceholder')}
            />
          </div>

          <Button onClick={save} loading={pending}>
            {t('save')}
          </Button>
        </div>
      )}
    </div>
  );
}
