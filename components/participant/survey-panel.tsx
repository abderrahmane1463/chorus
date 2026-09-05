'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { submitResponseAction } from '@/lib/actions/response';
import type { SurveyDetail } from '@/lib/queries/survey';
import { cn } from '@/lib/utils/cn';

type Answers = Record<string, { optionIds: string[]; value?: number; text?: string }>;

export function SurveyPanel({
  survey,
  answers,
}: {
  survey: SurveyDetail;
  answers: Answers;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Answers>(answers);

  const oneByOne = (survey.settings.navigationMode ?? 'all_at_once') === 'one_by_one';
  const answeredCount = survey.questions.filter((q) => answers[q.id]).length;
  const complete = answeredCount === survey.questions.length;

  if (survey.questions.length === 0) {
    return (
      <Card className="p-5 text-center text-sm text-muted-foreground">
        This survey has no questions yet.
      </Card>
    );
  }

  function send(questionId: string, payload: Record<string, unknown>) {
    startTransition(async () => {
      const result = await submitResponseAction({ interactionId: questionId, ...payload });
      if (result.ok) {
        router.refresh();
        if (oneByOne && index < survey.questions.length - 1) {
          setIndex(index + 1);
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  const visible = oneByOne ? [survey.questions[index]] : survey.questions;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {answeredCount} of {survey.questions.length} answered
        </span>
        {complete && (
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <Check className="size-4" aria-hidden />
            All done
          </span>
        )}
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={survey.questions.length}
      >
        <div
          className="bar-fill h-full rounded-full bg-primary"
          style={{ width: `${(answeredCount / survey.questions.length) * 100}%` }}
        />
      </div>

      {visible.map((question) => {
        const saved = answers[question.id];
        const draft = drafts[question.id] ?? { optionIds: [] };

        return (
          <Card key={question.id} className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold leading-snug">{question.title}</h2>
              {saved && (
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Answered" />
              )}
            </div>

            {question.type === 'multiple_choice' && (
              <div className="space-y-2">
                {question.options.map((option) => {
                  const active =
                    draft.optionIds.includes(option.id) ||
                    (!drafts[question.id] && saved?.optionIds.includes(option.id));
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setDrafts({ ...drafts, [question.id]: { optionIds: [option.id] } });
                        send(question.id, { optionIds: [option.id] });
                      }}
                      className={cn(
                        'w-full rounded-lg border px-4 py-3 text-left text-[15px] transition-colors',
                        active
                          ? 'border-primary bg-primary-subtle font-medium text-primary'
                          : 'border-border hover:border-primary',
                      )}
                    >
                      {option.text}
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === 'rating' && (
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  {
                    length:
                      (question.settings.scaleMax ?? 5) -
                      (question.settings.scaleMin ?? 1) +
                      1,
                  },
                  (_, offset) => (question.settings.scaleMin ?? 1) + offset,
                ).map((value) => {
                  const active =
                    draft.value === value || (!drafts[question.id] && saved?.value === value);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setDrafts({ ...drafts, [question.id]: { optionIds: [], value } });
                        send(question.id, { value });
                      }}
                      className={cn(
                        'h-12 flex-1 rounded-lg border font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary',
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === 'open_text' && (
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  maxLength={question.settings.maxLength ?? 280}
                  defaultValue={saved?.text ?? ''}
                  placeholder="Type your answer…"
                  onChange={(event) =>
                    setDrafts({
                      ...drafts,
                      [question.id]: { optionIds: [], text: event.target.value },
                    })
                  }
                />
                <Button
                  size="sm"
                  loading={pending}
                  disabled={(draft.text ?? '').trim().length === 0}
                  onClick={() => send(question.id, { text: draft.text })}
                >
                  {saved ? 'Update answer' : 'Save answer'}
                </Button>
              </div>
            )}
          </Card>
        );
      })}

      {oneByOne && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ChevronLeft />
            Back
          </Button>
          <span className="text-sm text-muted-foreground">
            {index + 1} / {survey.questions.length}
          </span>
          <Button
            variant="secondary"
            disabled={index === survey.questions.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
