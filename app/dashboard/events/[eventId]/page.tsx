import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart3, Layers, Presentation, Settings } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import {
  getInteractionForOwner,
  getInteractionResults,
  listInteractions,
} from '@/lib/queries/interactions';
import {
  listQuestions,
  QUESTION_SORTS,
  type QuestionSort,
} from '@/lib/queries/questions';
import { getLeaderboard, getQuizDetail } from '@/lib/queries/quiz';
import { getSurveyDetail } from '@/lib/queries/survey';
import { InteractionList } from '@/components/dashboard/interaction-list';
import { InteractionTypePicker } from '@/components/dashboard/interaction-type-picker';
import { InteractionEditor } from '@/components/dashboard/interaction-editor';
import { CopyButton } from '@/components/dashboard/copy-button';
import { EmptyState } from '@/components/shared/empty-state';
import { LiveIndicator } from '@/components/shared/live-indicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  return { title: event?.title ?? 'Event' };
}

const statusVariant = {
  live: 'success',
  draft: 'neutral',
  ended: 'outline',
  archived: 'outline',
} as const;

export default async function EventWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ i?: string; qs?: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const { i: requestedId, qs } = await searchParams;

  const event = await getEventForOwner(eventId, user.id);
  if (!event) notFound();

  const interactions = await listInteractions(event.id);

  // Fall back to the first interaction so the editor is never blank when the
  // event has content.
  const selectedId =
    requestedId && interactions.some((item) => item.id === requestedId)
      ? requestedId
      : interactions[0]?.id;

  const selected = selectedId
    ? await getInteractionForOwner(selectedId, user.id)
    : null;

  const results = selected ? await getInteractionResults(selected) : null;

  // Q&A stores questions rather than responses, so it loads its own data.
  const questionSort: QuestionSort = QUESTION_SORTS.includes(qs as QuestionSort)
    ? (qs as QuestionSort)
    : 'votes';

  const questions =
    selected?.type === 'q_and_a'
      ? await listQuestions({
          interactionId: selected.id,
          participantId: null,
          isHost: true,
          sort: questionSort,
        })
      : undefined;

  // Quizzes carry child questions and standings of their own.
  const quiz = selected?.type === 'quiz' ? await getQuizDetail(selected.id) : null;
  const leaderboard = quiz ? await getLeaderboard(quiz.id) : [];

  const survey =
    selected?.type === 'survey' ? await getSurveyDetail(selected.id) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-5 py-4 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/dashboard/events"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All events
          </Link>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold">{event.title}</h1>
                <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
                <LiveIndicator eventId={event.id} withQa />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm font-medium tracking-wider">
                {event.eventCode}
              </span>
              <CopyButton
                value={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/event/${event.eventCode}`}
                label="Copy join link"
                successMessage="Join link copied"
              />
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/events/${event.id}/analytics`}>
                  <BarChart3 />
                  Analytics
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/events/${event.id}/settings`}>
                  <Settings />
                  Settings
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/present/${event.id}`} target="_blank">
                  <Presentation />
                  Present
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8">
        {interactions.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No interactions yet"
            description="Add a poll, a word cloud or a rating and it will appear here."
            action={<InteractionTypePicker eventId={event.id} />}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div className="space-y-3">
              <InteractionTypePicker
                eventId={event.id}
                variant="secondary"
                className="w-full"
              />
              <InteractionList
                eventId={event.id}
                interactions={interactions}
                selectedId={selected?.id}
              />
            </div>

            <div className="min-w-0">
              {selected && results ? (
                <InteractionEditor
                  key={selected.id}
                  interaction={selected}
                  results={results}
                  questions={questions}
                  questionSort={questionSort}
                  quiz={quiz}
                  leaderboard={leaderboard}
                  survey={survey}
                />
              ) : (
                <EmptyState
                  icon={Layers}
                  title="Pick an interaction"
                  description="Choose one from the list to edit it."
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
