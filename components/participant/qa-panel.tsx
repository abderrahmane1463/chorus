'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MessagesSquare } from 'lucide-react';
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
  const router = useRouter();
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [pending, startTransition] = useTransition();

  const allowAnonymous = settings.allowAnonymous ?? true;
  const allowUpvotes = settings.allowUpvotes ?? true;
  const moderated = settings.moderationEnabled ?? false;

  function ask() {
    startTransition(async () => {
      const result = await askQuestionAction({
        interactionId,
        text,
        isAnonymous: allowAnonymous ? anonymous : false,
      });
      if (result.ok) {
        setText('');
        toast.success(
          moderated ? 'Sent — the host will review it' : 'Question sent',
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function upvote(questionId: string) {
    startTransition(async () => {
      const result = await toggleQuestionVoteAction({ questionId });
      if (result.ok) router.refresh();
      else toast.error(result.error);
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
          placeholder="Ask a question…"
          aria-label="Your question"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {allowAnonymous ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={anonymous} onCheckedChange={setAnonymous} />
              Ask anonymously
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              Questions show your name.
            </span>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {text.length}/{MAX_LENGTH}
            </span>
            <Button onClick={ask} loading={pending} disabled={text.trim().length < 3}>
              Send
            </Button>
          </div>
        </div>

        {moderated && (
          <p className="mt-2 text-xs text-muted-foreground">
            The host reviews questions before the room sees them.
          </p>
        )}
      </Card>

      {questions.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No questions yet"
          description="Be the first to ask."
        />
      ) : (
        <ul className="space-y-2">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              onUpvote={allowUpvotes ? upvote : undefined}
              upvoteDisabled={pending || question.status === 'pending'}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
