'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Play, Plus, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResultsView } from '@/components/interactions/results-view';
import { QaModeration } from './qa-moderation';
import { QuizEditor } from './quiz-editor';
import { SurveyEditor } from './survey-editor';
import type { SurveyDetail } from '@/lib/queries/survey';
import type { LeaderboardRow, QuizDetail } from '@/lib/queries/quiz';
import type { QuestionItem, QuestionSort } from '@/lib/queries/questions';
import { getInteractionMeta } from '@/lib/interactions/registry';
import type { InteractionDetail, InteractionResults } from '@/lib/queries/interactions';
import {
  deleteInteractionAction,
  resetInteractionAction,
  setInteractionStatusAction,
  updateInteractionAction,
} from '@/lib/actions/interaction';
import type { InteractionSettings } from '@/types/interactions';
import {
  DEFAULT_REVEAL_SECONDS,
  MAX_REVEAL_SECONDS,
  MIN_REVEAL_SECONDS,
  type QuizPhase,
} from '@/lib/quiz/pacing';

type OptionDraft = { id?: string; text: string };

export type QuizRun = {
  phase: QuizPhase;
  /** When the quiz next moves on by itself (epoch ms), or null if it waits for the host. */
  dueAt: number | null;
  playerCount: number;
  serverNow: number;
};

const IDLE_RUN: QuizRun = { phase: 'idle', dueAt: null, playerCount: 0, serverNow: 0 };

export function InteractionEditor({
  interaction,
  results,
  questions,
  questionSort = 'votes',
  quiz,
  leaderboard = [],
  survey,
  quizRun = IDLE_RUN,
}: {
  /** Where a quiz is in its run. Only meaningful when `quiz` is set. */
  quizRun?: QuizRun;
  interaction: InteractionDetail;
  results: InteractionResults;
  questions?: QuestionItem[];
  questionSort?: QuestionSort;
  quiz?: QuizDetail | null;
  leaderboard?: LeaderboardRow[];
  survey?: SurveyDetail | null;
}) {
  const router = useRouter();
  const t = useTranslations('editor');
  const tTypes = useTranslations('types');
  const tStatus = useTranslations('interactionStatus');
  const meta = getInteractionMeta(interaction.type);

  const [title, setTitle] = useState(interaction.title);
  const [description, setDescription] = useState(interaction.description ?? '');
  const [settings, setSettings] = useState<InteractionSettings>(interaction.settings);
  const [options, setOptions] = useState<OptionDraft[]>(
    interaction.options.map((option) => ({ id: option.id, text: option.text })),
  );

  const [saving, startSave] = useTransition();
  const [controlling, startControl] = useTransition();

  function patch(next: Partial<InteractionSettings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function save() {
    startSave(async () => {
      const result = await updateInteractionAction({
        interactionId: interaction.id,
        title,
        description,
        settings,
        options: meta?.hasOptions ? options : undefined,
      });
      if (result.ok) {
        toast.success(t('saved'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function setStatus(status: 'active' | 'closed') {
    startControl(async () => {
      const result = await setInteractionStatusAction({
        interactionId: interaction.id,
        status,
      });
      if (result.ok) {
        toast.success(status === 'active' ? t('nowLive') : t('nowClosed'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function reset() {
    startControl(async () => {
      const result = await resetInteractionAction({ interactionId: interaction.id });
      if (result.ok) {
        toast.success(t('cleared'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startControl(async () => {
      const result = await deleteInteractionAction({ interactionId: interaction.id });
      if (result.ok) {
        toast.success(t('deleted'));
        router.push(`/dashboard/events/${interaction.eventId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const hasResponses = results.total > 0;
  const isQuiz = interaction.type === 'quiz';
  const isSurvey = interaction.type === 'survey';

  // A quiz or survey holds questions; its own title is a name, not a question.
  // Calling it "Question" sent hosts looking for an answers field that lives
  // further down, on each question.
  const container = isQuiz || isSurvey;
  const titleLabel = isQuiz ? 'quizName' : isSurvey ? 'surveyName' : 'question';
  const titlePlaceholder = isQuiz
    ? 'quizNamePlaceholder'
    : isSurvey
      ? 'surveyNamePlaceholder'
      : 'questionPlaceholder';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={interaction.status === 'active' ? 'success' : 'neutral'}>
            {interaction.status === 'active' ? t('live') : tStatus(interaction.status)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {meta ? tTypes(`${meta.type}.name`) : interaction.type}
          </span>
        </div>

        {/* A quiz is driven by its own run controls, so the generic
            start/stop/reset buttons would fight with them. */}
        <div className="flex flex-wrap gap-2">
          {!isQuiz && (
            <>
              {interaction.status === 'active' ? (
                <Button
                  variant="secondary"
                  onClick={() => setStatus('closed')}
                  loading={controlling}
                >
                  <Square />
                  {t('stop')}
                </Button>
              ) : (
                <Button
                  onClick={() => setStatus('active')}
                  loading={controlling}
                  disabled={title.trim().length === 0}
                >
                  <Play />
                  {t('start')}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={reset}
                disabled={!hasResponses || controlling}
              >
                <RotateCcw />
                {t('reset')}
              </Button>
            </>
          )}
          <Button variant="destructive" onClick={remove} disabled={controlling}>
            <Trash2 />
            {t('delete')}
          </Button>
        </div>
      </div>

      {title.trim().length === 0 && (
        <p className="rounded-md bg-accent-subtle px-3 py-2 text-sm text-accent">
          {container ? t('needName') : t('needQuestion')}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t(titleLabel)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">{t(titleLabel)}</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              placeholder={t(titlePlaceholder)}
            />
            {container && (
              <p className="text-xs text-muted-foreground">{t('questionsBelow')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t('context')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          {meta?.hasOptions && (
            <OptionsEditor
              options={options}
              onChange={setOptions}
              warnOnDelete={hasResponses}
            />
          )}

          <SettingsEditor type={interaction.type} settings={settings} onPatch={patch} />

          <Button onClick={save} loading={saving}>
            {t('save')}
          </Button>
        </CardContent>
      </Card>

      {isQuiz && quiz ? (
        <QuizEditor
          quiz={quiz}
          leaderboard={leaderboard}
          phase={quizRun.phase}
          dueAt={quizRun.dueAt}
          playerCount={quizRun.playerCount}
          serverNow={quizRun.serverNow}
        />
      ) : interaction.type === 'survey' && survey ? (
        <SurveyEditor survey={survey} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {interaction.type === 'q_and_a' ? t('roomQuestions') : t('results')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {interaction.type === 'q_and_a' ? (
              <QaModeration
                questions={questions ?? []}
                sort={questionSort}
                onSortChange={(next) => {
                  const params = new URLSearchParams(window.location.search);
                  params.set('qs', next);
                  router.push(`?${params.toString()}`, { scroll: false });
                }}
              />
            ) : (
              <ResultsView results={results} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
  warnOnDelete,
}: {
  options: OptionDraft[];
  onChange: (next: OptionDraft[]) => void;
  warnOnDelete: boolean;
}) {
  const t = useTranslations('editor');

  function update(index: number, text: string) {
    onChange(options.map((option, i) => (i === index ? { ...option, text } : option)));
  }

  function remove(index: number) {
    const option = options[index];
    // Deleting a saved option deletes its votes with it, so make that explicit.
    if (warnOnDelete && option.id) {
      const confirmed = window.confirm(t('confirmOptionDelete'));
      if (!confirmed) return;
    }
    onChange(options.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label>{t('options')}</Label>
      {options.map((option, index) => (
        <div key={option.id ?? `new-${index}`} className="flex gap-2">
          <Input
            value={option.text}
            onChange={(event) => update(index, event.target.value)}
            maxLength={160}
            placeholder={t('optionPlaceholder', { number: index + 1 })}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            disabled={options.length <= 2}
            aria-label={t('removeOption', { number: index + 1 })}
          >
            <X />
          </Button>
        </div>
      ))}
      {options.length < 10 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...options, { text: '' }])}
        >
          <Plus />
          {t('addOption')}
        </Button>
      )}
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingsEditor({
  type,
  settings,
  onPatch,
}: {
  type: string;
  settings: InteractionSettings;
  onPatch: (next: Partial<InteractionSettings>) => void;
}) {
  const t = useTranslations('settings');

  return (
    <div className="divide-y divide-border rounded-lg border border-border px-4">
      {type === 'multiple_choice' && (
        <>
          <SettingRow label={t('allowMultiple')}>
            <Switch
              checked={settings.allowMultiple ?? false}
              onCheckedChange={(checked) =>
                onPatch({ allowMultiple: checked, maxSelections: checked ? 2 : 1 })
              }
            />
          </SettingRow>
          {settings.allowMultiple && (
            <SettingRow label={t('maxSelections')}>
              <Input
                type="number"
                min={2}
                max={10}
                value={settings.maxSelections ?? 2}
                onChange={(event) =>
                  onPatch({ maxSelections: Number(event.target.value) })
                }
                className="w-20"
              />
            </SettingRow>
          )}
          <SettingRow label={t('allowChange')}>
            <Switch
              checked={settings.allowChangeAnswer ?? false}
              onCheckedChange={(checked) => onPatch({ allowChangeAnswer: checked })}
            />
          </SettingRow>
        </>
      )}

      {type === 'rating' && (
        <>
          <SettingRow label={t('scaleMin')}>
            <Input
              type="number"
              min={0}
              max={1}
              value={settings.scaleMin ?? 1}
              onChange={(event) => onPatch({ scaleMin: Number(event.target.value) })}
              className="w-20"
            />
          </SettingRow>
          <SettingRow label={t('scaleMax')}>
            <Input
              type="number"
              min={3}
              max={10}
              value={settings.scaleMax ?? 5}
              onChange={(event) => onPatch({ scaleMax: Number(event.target.value) })}
              className="w-20"
            />
          </SettingRow>
          <SettingRow label={t('minLabel')}>
            <Input
              value={settings.minLabel ?? ''}
              onChange={(event) => onPatch({ minLabel: event.target.value })}
              maxLength={40}
              placeholder={t('minLabelPlaceholder')}
              className="w-44"
            />
          </SettingRow>
          <SettingRow label={t('maxLabel')}>
            <Input
              value={settings.maxLabel ?? ''}
              onChange={(event) => onPatch({ maxLabel: event.target.value })}
              maxLength={40}
              placeholder={t('maxLabelPlaceholder')}
              className="w-44"
            />
          </SettingRow>
        </>
      )}

      {type === 'word_cloud' && (
        <SettingRow
          label={t('entriesPerPerson')}
          hint={t('entriesHint')}
        >
          <Input
            type="number"
            min={1}
            max={5}
            value={settings.maxEntriesPerParticipant ?? 1}
            onChange={(event) =>
              onPatch({ maxEntriesPerParticipant: Number(event.target.value) })
            }
            className="w-20"
          />
        </SettingRow>
      )}

      {type === 'open_text' && (
        <>
          <SettingRow label={t('maxLength')}>
            <Input
              type="number"
              min={20}
              max={1000}
              step={10}
              value={settings.maxLength ?? 280}
              onChange={(event) => onPatch({ maxLength: Number(event.target.value) })}
              className="w-24"
            />
          </SettingRow>
          <SettingRow
            label={t('allowSeveral')}
            hint={t('allowSeveralHint')}
          >
            <Switch
              checked={settings.allowMultipleSubmissions ?? false}
              onCheckedChange={(checked) =>
                onPatch({ allowMultipleSubmissions: checked })
              }
            />
          </SettingRow>
        </>
      )}

      {type === 'q_and_a' && (
        <>
          <SettingRow
            label={t('allowAnonymous')}
            hint={t('allowAnonymousHint')}
          >
            <Switch
              checked={settings.allowAnonymous ?? true}
              onCheckedChange={(checked) => onPatch({ allowAnonymous: checked })}
            />
          </SettingRow>
          <SettingRow
            label={t('moderate')}
            hint={t('moderateHint')}
          >
            <Switch
              checked={settings.moderationEnabled ?? false}
              onCheckedChange={(checked) => onPatch({ moderationEnabled: checked })}
            />
          </SettingRow>
          <SettingRow label={t('allowUpvotes')}>
            <Switch
              checked={settings.allowUpvotes ?? true}
              onCheckedChange={(checked) => onPatch({ allowUpvotes: checked })}
            />
          </SettingRow>
        </>
      )}

      {/* How the run is paced. Time limits and points are per question and
          sit on each one; these two belong to the quiz as a whole. */}
      {type === 'quiz' && (
        <>
          <SettingRow label={t('autoAdvance')} hint={t('autoAdvanceHint')}>
            <Switch
              checked={settings.autoAdvance ?? true}
              onCheckedChange={(checked) => onPatch({ autoAdvance: checked })}
            />
          </SettingRow>
          {(settings.autoAdvance ?? true) && (
            <SettingRow label={t('revealSeconds')} hint={t('revealSecondsHint')}>
              <Input
                type="number"
                min={MIN_REVEAL_SECONDS}
                max={MAX_REVEAL_SECONDS}
                value={settings.revealSeconds ?? DEFAULT_REVEAL_SECONDS}
                onChange={(event) => onPatch({ revealSeconds: Number(event.target.value) })}
                className="w-20"
              />
            </SettingRow>
          )}
        </>
      )}

      {/* Q&A and quizzes have no aggregate results, so the visibility toggle
          would control nothing. */}
      {type === 'survey' && (
        <SettingRow
          label={t('oneByOne')}
          hint={t('oneByOneHint')}
        >
          <Switch
            checked={(settings.navigationMode ?? 'all_at_once') === 'one_by_one'}
            onCheckedChange={(checked) =>
              onPatch({ navigationMode: checked ? 'one_by_one' : 'all_at_once' })
            }
          />
        </SettingRow>
      )}

      {type !== 'q_and_a' && type !== 'quiz' && type !== 'survey' && (
        <SettingRow
          label={t('showResults')}
          hint={t('showResultsHint')}
        >
          <Switch
            checked={settings.showResultsToParticipants ?? false}
            onCheckedChange={(checked) => onPatch({ showResultsToParticipants: checked })}
          />
        </SettingRow>
      )}
    </div>
  );
}
