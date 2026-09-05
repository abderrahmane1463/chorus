'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Eye, Play, Plus, RotateCcw, SkipForward, Square, Trash2, X } from 'lucide-react';
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
import { cn } from '@/lib/utils/cn';
import { pluralize } from '@/lib/utils/format';

export function QuizEditor({
  quiz,
  leaderboard,
}: {
  quiz: QuizDetail;
  leaderboard: LeaderboardRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const currentIndex = quiz.questions.findIndex((q) => q.id === quiz.currentChildId);
  const isLast = currentIndex === quiz.questions.length - 1;
  const running = quiz.status === 'active';

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

  function addQuestion() {
    startTransition(async () => {
      const result = await addQuizQuestionAction({ quizId: quiz.id });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Run the quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {!running ? (
              <Button
                onClick={() => control('start', 'Quiz started')}
                loading={pending}
                disabled={quiz.questions.length === 0}
              >
                <Play />
                Start quiz
              </Button>
            ) : (
              <>
                {!quiz.answerRevealed && (
                  <Button onClick={() => control('reveal', 'Answer revealed')} loading={pending}>
                    <Eye />
                    Reveal answer
                  </Button>
                )}
                {!isLast && (
                  <Button
                    variant="secondary"
                    onClick={() => control('next', 'Next question')}
                    loading={pending}
                  >
                    <SkipForward />
                    Next question
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => control('finish', 'Quiz finished')}
                  loading={pending}
                >
                  <Square />
                  Finish quiz
                </Button>
              </>
            )}

            <Button
              variant="destructive"
              onClick={() => control('restart', 'Quiz reset')}
              disabled={pending}
              className="ml-auto"
            >
              <RotateCcw />
              Restart and clear scores
            </Button>
          </div>

          {running && currentIndex >= 0 && (
            <p className="text-sm text-muted-foreground">
              Showing question {currentIndex + 1} of {quiz.questions.length}
              {quiz.answerRevealed ? ' · answer revealed' : ''}
            </p>
          )}
          {quiz.questions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add at least one question before starting.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Questions{' '}
            <span className="font-normal text-muted-foreground">
              ({quiz.questions.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quiz.questions.length === 0 ? (
            <EmptyState
              title="No questions yet"
              description="Each question has a timer, points and one or more correct answers."
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

          <Button variant="secondary" onClick={addQuestion} loading={pending}>
            <Plus />
            Add question
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
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
        toast.success('Question saved');
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
        toast.success('Question deleted');
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
          className="min-w-0 flex-1 text-left"
        >
          <span className="text-xs text-muted-foreground">Question {index + 1}</span>
          <span
            className={cn(
              'mt-0.5 block truncate font-medium',
              !title && 'italic text-muted-foreground',
            )}
          >
            {title || 'Untitled question'}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {timeLimit}s · {points} pts ·{' '}
            {pluralize(question.answerCount, 'answer')}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {isCurrent && <Badge variant="success">On screen</Badge>}
          <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete question">
            <Trash2 />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`q-${question.id}`}>Question</Label>
            <Input
              id={`q-${question.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              placeholder="Which objective optimises for purchases?"
            />
          </div>

          <div className="space-y-2">
            <Label>Answers — tick the correct one(s)</Label>
            {options.map((option, optionIndex) => (
              <div key={option.id ?? `new-${optionIndex}`} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={option.isCorrect ? 'Marked correct' : 'Mark as correct'}
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
                  placeholder={`Answer ${optionIndex + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={options.length <= 2}
                  onClick={() => setOptions(options.filter((_, i) => i !== optionIndex))}
                  aria-label={`Remove answer ${optionIndex + 1}`}
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
                Add answer
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`t-${question.id}`}>Time limit (seconds)</Label>
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
              <Label htmlFor={`p-${question.id}`}>Points</Label>
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
              <span className="font-medium">Speed bonus</span>
              <span className="block text-xs text-muted-foreground">
                Faster correct answers score more.
              </span>
            </span>
            <Switch checked={speedBonus} onCheckedChange={setSpeedBonus} />
          </label>

          <div className="space-y-1.5">
            <Label htmlFor={`e-${question.id}`}>Explanation (optional)</Label>
            <Input
              id={`e-${question.id}`}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              maxLength={300}
              placeholder="Shown after you reveal the answer"
            />
          </div>

          <Button onClick={save} loading={pending}>
            Save question
          </Button>
        </div>
      )}
    </div>
  );
}
