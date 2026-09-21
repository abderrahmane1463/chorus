'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { submitResponseAction } from '@/lib/actions/response';
import type { InteractionSettings } from '@/types/interactions';
import { RankingAnswer } from './ranking-answer';

type Option = { id: string; text: string };

type Props = {
  interactionId: string;
  type: string;
  settings: InteractionSettings;
  options: Option[];
  /** Answers this participant has already submitted. */
  mySelections: string[];
  myRating?: number;
  myTexts: string[];
  myOrder: string[];
  entriesLeft: number;
};

export function AnswerForm(props: Props) {
  const router = useRouter();
  const t = useTranslations('answers');
  const [pending, startTransition] = useTransition();

  function submit(payload: Record<string, unknown>, onDone?: () => void) {
    startTransition(async () => {
      const result = await submitResponseAction({
        interactionId: props.interactionId,
        ...payload,
      });
      if (result.ok) {
        toast.success(t('sent'));
        onDone?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  switch (props.type) {
    case 'multiple_choice':
      return <ChoiceAnswer {...props} pending={pending} onSubmit={submit} />;
    case 'rating':
      return <RatingAnswer {...props} pending={pending} onSubmit={submit} />;
    case 'word_cloud':
      return <WordAnswer {...props} pending={pending} onSubmit={submit} />;
    case 'open_text':
      return <TextAnswer {...props} pending={pending} onSubmit={submit} />;
    case 'ranking':
      return (
        <RankingAnswer
          options={props.options}
          myOrder={props.myOrder}
          pending={pending}
          onSubmit={(optionIds) => submit({ optionIds })}
        />
      );
    default:
      return null;
  }
}

type InnerProps = Props & {
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>, onDone?: () => void) => void;
};

function ChoiceAnswer({
  options,
  settings,
  mySelections,
  pending,
  onSubmit,
}: InnerProps) {
  const t = useTranslations('answers');
  const multiple = settings.allowMultiple ?? false;
  const [selected, setSelected] = useState<string[]>(mySelections);
  const locked = mySelections.length > 0 && !(settings.allowChangeAnswer ?? false);

  function toggle(optionId: string) {
    if (locked) return;
    setSelected((current) => {
      if (!multiple) return [optionId];
      if (current.includes(optionId)) {
        return current.filter((id) => id !== optionId);
      }
      const limit = settings.maxSelections ?? options.length;
      if (current.length >= limit) return current;
      return [...current, optionId];
    });
  }

  const changed =
    selected.length > 0 &&
    (selected.length !== mySelections.length ||
      selected.some((id) => !mySelections.includes(id)));

  return (
    <div className="space-y-3">
      {multiple && (
        <p className="text-sm text-muted-foreground">
          {t('chooseUpTo', { count: settings.maxSelections ?? options.length })}
        </p>
      )}

      <div className="space-y-2">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              disabled={locked}
              aria-pressed={active}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-start text-[15px] transition-colors',
                active
                  ? 'border-primary bg-primary-subtle font-medium text-primary'
                  : 'border-border hover:border-primary',
                locked && 'cursor-not-allowed opacity-70',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center border',
                  multiple ? 'rounded-[4px]' : 'rounded-full',
                  active ? 'border-primary bg-primary' : 'border-input',
                )}
              >
                {active && <span className="size-2 rounded-full bg-primary-foreground" />}
              </span>
              {option.text}
            </button>
          );
        })}
      </div>

      {locked ? (
        <p className="text-sm text-muted-foreground">{t('locked')}</p>
      ) : (
        <Button
          className="w-full"
          size="lg"
          loading={pending}
          disabled={!changed}
          onClick={() => onSubmit({ optionIds: selected })}
        >
          {mySelections.length > 0 ? t('changeAnswer') : t('submit')}
        </Button>
      )}
    </div>
  );
}

function RatingAnswer({ settings, myRating, pending, onSubmit }: InnerProps) {
  const t = useTranslations('answers');
  const min = settings.scaleMin ?? 1;
  const max = settings.scaleMax ?? 5;
  const [value, setValue] = useState<number | undefined>(myRating);
  const locked = myRating !== undefined && !(settings.allowChangeAnswer ?? true);

  const scale = [];
  for (let n = min; n <= max; n++) scale.push(n);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {scale.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => !locked && setValue(n)}
            disabled={locked}
            aria-pressed={value === n}
            className={cn(
              'h-14 flex-1 rounded-lg border text-lg font-medium transition-colors',
              value === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary',
              locked && 'cursor-not-allowed opacity-70',
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {(settings.minLabel || settings.maxLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{settings.minLabel}</span>
          <span>{settings.maxLabel}</span>
        </div>
      )}

      {!locked && (
        <Button
          className="w-full"
          size="lg"
          loading={pending}
          disabled={value === undefined || value === myRating}
          onClick={() => onSubmit({ value })}
        >
          {myRating !== undefined ? t('changeRating') : t('submit')}
        </Button>
      )}
    </div>
  );
}

function WordAnswer({ myTexts, entriesLeft, pending, onSubmit }: InnerProps) {
  const t = useTranslations('answers');
  // Joins with the reader's own separator: "a, b and c", "a، b و c".
  const format = useFormatter();
  const [word, setWord] = useState('');

  return (
    <div className="space-y-3">
      {myTexts.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('youSubmitted', { words: format.list(myTexts) })}
        </p>
      )}

      {entriesLeft > 0 ? (
        <>
          <Input
            value={word}
            onChange={(event) => setWord(event.target.value)}
            maxLength={60}
            placeholder={t('wordPlaceholder')}
            className="h-12 text-center text-lg"
          />
          <Button
            className="w-full"
            size="lg"
            loading={pending}
            disabled={word.trim().length === 0}
            onClick={() => onSubmit({ text: word }, () => setWord(''))}
          >
            {t('send')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('entriesLeft', { count: entriesLeft })}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('allUsed')}</p>
      )}
    </div>
  );
}

function TextAnswer({ settings, myTexts, entriesLeft, pending, onSubmit }: InnerProps) {
  const t = useTranslations('answers');
  const [text, setText] = useState('');
  const maxLength = settings.maxLength ?? 280;

  if (entriesLeft === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('yourAnswer')}</p>
        {myTexts.map((entry, index) => (
          <p key={index} className="rounded-lg border border-border p-3 text-sm">
            {entry}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={maxLength}
        rows={4}
        placeholder={t('textPlaceholder')}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">
          {text.length}/{maxLength}
        </span>
        <Button
          loading={pending}
          disabled={text.trim().length === 0}
          onClick={() => onSubmit({ text }, () => setText(''))}
        >
          {t('send')}
        </Button>
      </div>
    </div>
  );
}
