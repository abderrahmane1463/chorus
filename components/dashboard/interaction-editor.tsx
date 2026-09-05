'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Play, Plus, RotateCcw, Square, Trash2, X } from 'lucide-react';
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

type OptionDraft = { id?: string; text: string };

export function InteractionEditor({
  interaction,
  results,
  questions,
  questionSort = 'votes',
  quiz,
  leaderboard = [],
  survey,
}: {
  interaction: InteractionDetail;
  results: InteractionResults;
  questions?: QuestionItem[];
  questionSort?: QuestionSort;
  quiz?: QuizDetail | null;
  leaderboard?: LeaderboardRow[];
  survey?: SurveyDetail | null;
}) {
  const router = useRouter();
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
        toast.success('Saved');
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
        toast.success(status === 'active' ? 'Interaction is live' : 'Interaction closed');
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
        toast.success('Responses cleared');
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
        toast.success('Interaction deleted');
        router.push(`/dashboard/events/${interaction.eventId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const hasResponses = results.total > 0;
  const isQuiz = interaction.type === 'quiz';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={interaction.status === 'active' ? 'success' : 'neutral'}>
            {interaction.status === 'active' ? 'Live' : interaction.status}
          </Badge>
          <span className="text-sm text-muted-foreground">{meta?.name}</span>
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
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={() => setStatus('active')}
                  loading={controlling}
                  disabled={title.trim().length === 0}
                >
                  <Play />
                  Start
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={reset}
                disabled={!hasResponses || controlling}
              >
                <RotateCcw />
                Reset
              </Button>
            </>
          )}
          <Button variant="destructive" onClick={remove} disabled={controlling}>
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      {title.trim().length === 0 && (
        <p className="rounded-md bg-accent-subtle px-3 py-2 text-sm text-accent">
          Add a question before starting this interaction.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Question</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              placeholder="What is your primary advertising platform?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Extra context (optional)</Label>
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
            Save
          </Button>
        </CardContent>
      </Card>

      {isQuiz && quiz ? (
        <QuizEditor quiz={quiz} leaderboard={leaderboard} />
      ) : interaction.type === 'survey' && survey ? (
        <SurveyEditor survey={survey} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {interaction.type === 'q_and_a' ? 'Questions from the room' : 'Results'}
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
  function update(index: number, text: string) {
    onChange(options.map((option, i) => (i === index ? { ...option, text } : option)));
  }

  function remove(index: number) {
    const option = options[index];
    // Deleting a saved option deletes its votes with it, so make that explicit.
    if (warnOnDelete && option.id) {
      const confirmed = window.confirm(
        'This poll already has responses. Removing this option also deletes the votes cast for it. Continue?',
      );
      if (!confirmed) return;
    }
    onChange(options.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label>Options</Label>
      {options.map((option, index) => (
        <div key={option.id ?? `new-${index}`} className="flex gap-2">
          <Input
            value={option.text}
            onChange={(event) => update(index, event.target.value)}
            maxLength={160}
            placeholder={`Option ${index + 1}`}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            disabled={options.length <= 2}
            aria-label={`Remove option ${index + 1}`}
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
          Add option
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
  return (
    <div className="divide-y divide-border rounded-lg border border-border px-4">
      {type === 'multiple_choice' && (
        <>
          <SettingRow label="Allow multiple answers">
            <Switch
              checked={settings.allowMultiple ?? false}
              onCheckedChange={(checked) =>
                onPatch({ allowMultiple: checked, maxSelections: checked ? 2 : 1 })
              }
            />
          </SettingRow>
          {settings.allowMultiple && (
            <SettingRow label="Maximum selections">
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
          <SettingRow label="Allow changing answer">
            <Switch
              checked={settings.allowChangeAnswer ?? false}
              onCheckedChange={(checked) => onPatch({ allowChangeAnswer: checked })}
            />
          </SettingRow>
        </>
      )}

      {type === 'rating' && (
        <>
          <SettingRow label="Scale starts at">
            <Input
              type="number"
              min={0}
              max={1}
              value={settings.scaleMin ?? 1}
              onChange={(event) => onPatch({ scaleMin: Number(event.target.value) })}
              className="w-20"
            />
          </SettingRow>
          <SettingRow label="Scale ends at">
            <Input
              type="number"
              min={3}
              max={10}
              value={settings.scaleMax ?? 5}
              onChange={(event) => onPatch({ scaleMax: Number(event.target.value) })}
              className="w-20"
            />
          </SettingRow>
          <SettingRow label="Low end label">
            <Input
              value={settings.minLabel ?? ''}
              onChange={(event) => onPatch({ minLabel: event.target.value })}
              maxLength={40}
              placeholder="Not at all"
              className="w-44"
            />
          </SettingRow>
          <SettingRow label="High end label">
            <Input
              value={settings.maxLabel ?? ''}
              onChange={(event) => onPatch({ maxLabel: event.target.value })}
              maxLength={40}
              placeholder="Very confident"
              className="w-44"
            />
          </SettingRow>
        </>
      )}

      {type === 'word_cloud' && (
        <SettingRow
          label="Entries per person"
          hint="How many words each participant may submit."
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
          <SettingRow label="Maximum length">
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
            label="Allow several answers"
            hint="Lets one person send up to five responses."
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
            label="Allow anonymous questions"
            hint="Participants can hide their name on a question."
          >
            <Switch
              checked={settings.allowAnonymous ?? true}
              onCheckedChange={(checked) => onPatch({ allowAnonymous: checked })}
            />
          </SettingRow>
          <SettingRow
            label="Review before showing"
            hint="New questions wait for your approval before the room sees them."
          >
            <Switch
              checked={settings.moderationEnabled ?? false}
              onCheckedChange={(checked) => onPatch({ moderationEnabled: checked })}
            />
          </SettingRow>
          <SettingRow label="Allow upvotes">
            <Switch
              checked={settings.allowUpvotes ?? true}
              onCheckedChange={(checked) => onPatch({ allowUpvotes: checked })}
            />
          </SettingRow>
        </>
      )}

      {/* Q&A and quizzes have no aggregate results, so the visibility toggle
          would control nothing. */}
      {type === 'survey' && (
        <SettingRow
          label="Show one question at a time"
          hint="Off shows the whole survey on a single screen."
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
          label="Show results to participants"
          hint="Results appear on their phone once they have answered."
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
