'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ResultsView } from '@/components/interactions/results-view';
import { getInteractionMeta, SURVEY_CHILD_TYPES } from '@/lib/interactions/registry';
import {
  addSurveyQuestionAction,
  deleteSurveyQuestionAction,
  saveSurveyQuestionAction,
} from '@/lib/actions/survey';
import type { SurveyDetail, SurveyQuestion } from '@/lib/queries/survey';
import { pluralize } from '@/lib/utils/format';

export function SurveyEditor({ survey }: { survey: SurveyDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function addQuestion(type: string) {
    startTransition(async () => {
      const result = await addSurveyQuestionAction({ surveyId: survey.id, type });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  const completionRate =
    survey.startedCount === 0
      ? 0
      : Math.round((survey.completedCount / survey.startedCount) * 100);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Questions</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {survey.questions.length}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Started</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {survey.startedCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Completed</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {survey.completedCount}
                {survey.startedCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {completionRate}%
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Questions{' '}
            <span className="font-normal text-muted-foreground">
              ({survey.questions.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {survey.questions.length === 0 ? (
            <EmptyState
              title="No questions yet"
              description="Add multiple choice, rating or open text questions below."
            />
          ) : (
            survey.questions.map((question, index) => (
              <SurveyQuestionEditor key={question.id} question={question} index={index} />
            ))
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <span className="w-full text-sm text-muted-foreground">Add a question</span>
            {SURVEY_CHILD_TYPES.map((type) => {
              const meta = getInteractionMeta(type);
              return (
                <Button
                  key={type}
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => addQuestion(type)}
                >
                  <Plus />
                  {meta?.name ?? type}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type OptionDraft = { id?: string; text: string };

function SurveyQuestionEditor({
  question,
  index,
}: {
  question: SurveyQuestion;
  index: number;
}) {
  const router = useRouter();
  const meta = getInteractionMeta(question.type);

  const [open, setOpen] = useState(question.title.trim().length === 0);
  const [title, setTitle] = useState(question.title);
  const [options, setOptions] = useState<OptionDraft[]>(
    question.options.map((option) => ({ id: option.id, text: option.text })),
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveSurveyQuestionAction({
        questionId: question.id,
        title,
        settings: question.settings,
        options: meta?.hasOptions ? options : undefined,
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
      const result = await deleteSurveyQuestionAction({ questionId: question.id });
      if (result.ok) {
        toast.success('Question deleted');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="text-xs text-muted-foreground">
            Question {index + 1} · {meta?.name}
          </span>
          <span className="mt-0.5 block truncate font-medium">
            {title || <span className="italic text-muted-foreground">Untitled</span>}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {pluralize(question.results.total, 'response')}
          </span>
        </button>

        <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete question">
          <Trash2 />
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`sq-${question.id}`}>Question</Label>
            <Input
              id={`sq-${question.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              placeholder="How satisfied were you with the session?"
            />
          </div>

          {meta?.hasOptions && (
            <div className="space-y-2">
              <Label>Options</Label>
              {options.map((option, optionIndex) => (
                <div key={option.id ?? `new-${optionIndex}`} className="flex gap-2">
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
                    placeholder={`Option ${optionIndex + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={options.length <= 2}
                    onClick={() => setOptions(options.filter((_, i) => i !== optionIndex))}
                    aria-label={`Remove option ${optionIndex + 1}`}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              {options.length < 10 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOptions([...options, { text: '' }])}
                >
                  <Plus />
                  Add option
                </Button>
              )}
            </div>
          )}

          <Button onClick={save} loading={pending}>
            Save question
          </Button>
        </div>
      )}

      {question.results.total > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <ResultsView results={question.results} />
        </div>
      )}
    </div>
  );
}
