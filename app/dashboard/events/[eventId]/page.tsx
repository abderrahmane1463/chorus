import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, BarChart3, Layers, Palette, Presentation, Settings } from 'lucide-react';
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
import {
  getLeaderboard,
  getLobbyPlayers,
  getQuizDetail,
  quizTiming,
} from '@/lib/queries/quiz';
import { countPresentPlayers } from '@/lib/queries/presence';
import { serverNow } from '@/lib/utils/server-time';
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
  const t = await getTranslations('event');
  return { title: event?.title ?? t('fallbackTitle') };
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

  // Asked together, in two rounds rather than one after another: each is a
  // round trip to the database, and the page waited on the sum of them.
  // The interaction asked for is read with its owner checked in the query,
  // so it can be read before the event is known to be this host's.
  const [event, interactions, requested, t, tStatus] = await Promise.all([
    getEventForOwner(eventId, user.id),
    listInteractions(eventId),
    requestedId ? getInteractionForOwner(requestedId, user.id) : null,
    getTranslations('workspace'),
    getTranslations('status'),
  ]);
  if (!event) notFound();

  // Fall back to the first interaction so the editor is never blank when the
  // event has content.
  const selectedId =
    requestedId && interactions.some((item) => item.id === requestedId)
      ? requestedId
      : interactions[0]?.id;

  const selected =
    requested && requested.id === selectedId
      ? requested
      : selectedId
        ? await getInteractionForOwner(selectedId, user.id)
        : null;

  // Q&A stores questions rather than responses, so it loads its own data.
  const questionSort: QuestionSort = QUESTION_SORTS.includes(qs as QuestionSort)
    ? (qs as QuestionSort)
    : 'votes';

  const isQuiz = selected?.type === 'quiz';

  // Everything the selected interaction needs, together. A quiz's standings
  // and its lobby are asked for alongside it; which of them is shown is
  // decided once its phase is known.
  const [results, questions, quiz, leaderboard, lobbyPlayers, presentCount, survey] =
    await Promise.all([
      selected ? getInteractionResults(selected) : null,
      selected?.type === 'q_and_a'
        ? listQuestions({
            interactionId: selected.id,
            participantId: null,
            isHost: true,
            sort: questionSort,
          })
        : undefined,
      isQuiz ? getQuizDetail(selected.id) : null,
      isQuiz ? getLeaderboard(selected.id) : [],
      isQuiz ? getLobbyPlayers(event.id) : null,
      countPresentPlayers(event.id),
      selected?.type === 'survey' ? getSurveyDetail(selected.id) : null,
    ]);

  const timing = quiz ? quizTiming(quiz, leaderboard.length > 0) : null;

  // Names are only shown while the room is filling. Outside the lobby only
  // the number is shown: who is in the room now, which is what "X of Y
  // answered" has to be measured against.
  const lobby =
    timing?.phase === 'lobby' && lobbyPlayers
      ? lobbyPlayers
      : { players: [], total: presentCount };

  const quizRun = timing
    ? {
        ...timing,
        playerCount: lobby.total,
        players: lobby.players,
        eventCode: event.eventCode,
        serverNow: serverNow(),
      }
    : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-5 py-4 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/dashboard/events"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t('allEvents')}
          </Link>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold">{event.title}</h1>
                <Badge variant={statusVariant[event.status]}>{tStatus(event.status)}</Badge>
                <LiveIndicator eventId={event.id} withQa withHost />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Join codes are Latin and never translated. */}
              <span
                dir="ltr"
                className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm font-medium tracking-wider"
              >
                {event.eventCode}
              </span>
              <CopyButton
                value={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/event/${event.eventCode}`}
                label={t('copyLink')}
                successMessage={t('linkCopied')}
              />
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/events/${event.id}/analytics`}>
                  <BarChart3 />
                  {t('analytics')}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/events/${event.id}/design`}>
                  <Palette />
                  {t('design')}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/events/${event.id}/settings`}>
                  <Settings />
                  {t('settings')}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/present/${event.id}`} target="_blank">
                  <Presentation />
                  {t('present')}
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
            title={t('noneTitle')}
            description={t('noneBody')}
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
                  quizRun={quizRun}
                  survey={survey}
                />
              ) : (
                <EmptyState
                  icon={Layers}
                  title={t('pickTitle')}
                  description={t('pickBody')}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
