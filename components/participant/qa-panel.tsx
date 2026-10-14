'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/empty-state';
import { QuestionCard } from '@/components/interactions/question-card';
import { askQuestionAction, toggleQuestionVoteAction } from '@/lib/actions/question';
import type { QuestionItem } from '@/lib/queries/questions';
import type { InteractionSettings } from '@/types/interactions';

const MAX_LENGTH = 500;

export function QaPanel({
  interactionId,
  settings,
  questions,
}: {
  interactionId: string;
  settings: InteractionSettings;
  questions: QuestionItem[];
}) {
  const t = useTranslations('qa');
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [, startTransition] = useTransition();

  const allowAnonymous = settings.allowAnonymous ?? true;
  const allowUpvotes = settings.allowUpvotes ?? true;
  const moderated = settings.moderationEnabled ?? false;

  // A vote or a question shows the moment it is tapped, without waiting for
  // the server; its own page replaces this when it answers, and a refusal
  // puts the list back as it was and says why.
  const [shown, change] = useOptimistic<QuestionItem[], Change>(questions, applyChange);

  function ask() {
    const sent = text;
    const isAnonymous = allowAnonymous ? anonymous : false;
    setText('');
    toast.success(moderated ? t('sentForReview') : t('sent'));
    startTransition(async () => {
      change({ kind: 'ask', text: sent, moderated });
      const result = await askQuestionAction({ interactionId, text: sent, isAnonymous });
      if (!result.ok) {
        // Given back, so nothing typed is lost.
        setText(sent);
        toast.error(result.error);
      }
    });
  }

  function upvote(questionId: string) {
    startTransition(async () => {
      change({ kind: 'vote', questionId });
      const result = await toggleQuestionVoteAction({ questionId });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={MAX_LENGTH}
          placeholder={t('placeholder')}
          aria-label={t('label')}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {allowAnonymous ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={anonymous} onCheckedChange={setAnonymous} />
              {t('anonymous')}
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('namesShown')}
            </span>
          )}

          <div className="ms-auto flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {text.length}/{MAX_LENGTH}
            </span>
            <Button onClick={ask} disabled={text.trim().length < 3}>
              {t('send')}
            </Button>
          </div>
        </div>

        {moderated && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('moderated')}
          </p>
        )}
      </Card>

      {shown.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      ) : (
        <ul className="space-y-2">
          {shown.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              onUpvote={allowUpvotes ? upvote : undefined}
              upvoteDisabled={question.status === 'pending'}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type Change =
  | { kind: 'vote'; questionId: string }
  | { kind: 'ask'; text: string; moderated: boolean };

/** The list as it will be once the server has taken this vote or question. */
function applyChange(list: QuestionItem[], change: Change): QuestionItem[] {
  if (change.kind === 'vote') {
    return list.map((question) =>
      question.id === change.questionId
        ? {
            ...question,
            votedByMe: !question.votedByMe,
            votes: question.votes + (question.votedByMe ? -1 : 1),
          }
        : question,
    );
  }

  const mine: QuestionItem = {
    id: `sending-${list.length}-${change.text.length}`,
    text: change.text,
    // Shown as waiting until the server has it, so it cannot be voted on yet.
    status: 'pending',
    isAnonymous: false,
    isHighlighted: false,
    authorName: null,
    createdAt: new Date(),
    votes: 0,
    votedByMe: false,
    isMine: true,
  };
  return [...list, mine];
}
