'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

export function SurveyEditor({ survey }: { survey: SurveyDetail }) {
  const router = useRouter();
  const t = useTranslations('surveyEditor');
  const tTypes = useTranslations('types');
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
          <CardTitle>{t('completion')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">{t('questionsStat')}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {survey.questions.length}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('started')}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {survey.startedCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('completed')}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {survey.completedCount}
                {survey.startedCount > 0 && (
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
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
            {t('questions')}{' '}
            <span className="font-normal text-muted-foreground">
              ({survey.questions.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {survey.questions.length === 0 ? (
            <EmptyState
              title={t('noneTitle')}
              description={t('noneBody2')}
            />
          ) : (
            survey.questions.map((question, index) => (
              <SurveyQuestionEditor key={question.id} question={question} index={index} />
            ))
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <span className="w-full text-sm text-muted-foreground">{t('addAQuestion')}</span>
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
                  {meta ? tTypes(`${meta.type}.name`) : type}
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
  const t = useTranslations('surveyEditor');
  const tTypes = useTranslations('types');
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
      const result = await deleteSurveyQuestionAction({ questionId: question.id });
      if (result.ok) {
        toast.success(t('deleted'));
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
          className="min-w-0 flex-1 text-start"
        >
          <span className="text-xs text-muted-foreground">
            {t('questionLabel', {
              number: index + 1,
              type: meta ? tTypes(`${meta.type}.name`) : question.type,
            })}
          </span>
          <span className="mt-0.5 block truncate font-medium">
            {title || (
              <span className="italic text-muted-foreground">{t('untitled')}</span>
            )}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t('answered', { count: question.results.total })}
          </span>
        </button>

        <Button variant="ghost" size="icon" onClick={remove} aria-label={t('delete')}>
          <Trash2 />
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`sq-${question.id}`}>{t('title')}</Label>
            <Input
              id={`sq-${question.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              placeholder={t('titlePlaceholder')}
            />
          </div>

          {meta?.hasOptions && (
            <div className="space-y-2">
              <Label>{t('options')}</Label>
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
                    placeholder={t('optionPlaceholder', { number: optionIndex + 1 })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={options.length <= 2}
                    onClick={() => setOptions(options.filter((_, i) => i !== optionIndex))}
                    aria-label={t('removeOption', { number: optionIndex + 1 })}
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
                  {t('addOption')}
                </Button>
              )}
            </div>
          )}

          <Button onClick={save} loading={pending}>
            {t('save')}
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
