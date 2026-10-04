import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { MessageSquareDashed } from 'lucide-react';
import { db } from '@/lib/db';
import { events, participants } from '@/db/schema';
import { readSessionId } from '@/lib/participant/session';
import { normalizeEventCode } from '@/lib/utils/event-code';
import { serverNow } from '@/lib/utils/server-time';
import {
  getActiveInteraction,
  getInteractionResults,
  getParticipantResponses,
} from '@/lib/queries/interactions';
import { maxEntriesFor } from '@/lib/interactions/registry';
import { EmptyState } from '@/components/shared/empty-state';
import { Logo } from '@/components/shared/logo';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { AnswerForm } from '@/components/participant/answer-form';
import { QaPanel } from '@/components/participant/qa-panel';
import { listQuestions } from '@/lib/queries/questions';
import { QuizPanel } from '@/components/participant/quiz-panel';
import {
  getLeaderboard,
  getParticipantQuizView,
  getPlayerStanding,
} from '@/lib/queries/quiz';
import { SurveyPanel } from '@/components/participant/survey-panel';
import { getSurveyAnswers, getSurveyDetail } from '@/lib/queries/survey';
import { ResultsView } from '@/components/interactions/results-view';
import { LiveIndicator } from '@/components/shared/live-indicator';
import { RealtimeEvent } from '@/lib/realtime/events';
import { Presence } from '@/hooks/use-presence';
import { Card } from '@/components/ui/card';
import { BrandLogo, BrandStyle, PartnerLogos } from '@/components/branding/brand';
import { readBranding } from '@/lib/branding/templates';
import { cn } from '@/lib/utils/cn';
import type { ResponseData } from '@/types/interactions';

/** How many rows of the scoreboard a phone shows. */
const PHONE_BOARD_SIZE = 10;

/**
 * The event behind a code, read once per request.
 *
 * The page's title and its body both need it; a phone refetches the page
 * on every change in the room, so the second read was a query every player
 * paid for every time.
 */
const findEvent = cache(async (code: string) => {
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      eventCode: events.eventCode,
      status: events.status,
      branding: events.branding,
    })
    .from(events)
    .where(eq(events.eventCode, code))
    .limit(1);

  return event ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;
  const event = await findEvent(normalizeEventCode(eventCode));

  const t = await getTranslations('event');
  return { title: event?.title ?? t('fallbackTitle') };
}

export default async function ParticipantEventPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;
  const code = normalizeEventCode(eventCode);
  const t = await getTranslations('event');

  const event = await findEvent(code);

  if (!event) notFound();

  const branding = readBranding(event.branding);

  // Without a joined session there is nobody to attribute answers to.
  const sessionId = await readSessionId();
  if (!sessionId) redirect(`/join?code=${encodeURIComponent(code)}`);

  // Asked together: a phone reloads this page on every change in the room, so
  // each round trip saved here is one every player feels.
  const [[participant], interaction] = await Promise.all([
    db
      .select({ id: participants.id, displayName: participants.displayName })
      .from(participants)
      .where(
        and(eq(participants.eventId, event.id), eq(participants.sessionId, sessionId)),
      )
      .limit(1),
    getActiveInteraction(event.id),
  ]);

  if (!participant) redirect(`/join?code=${encodeURIComponent(code)}`);

  const isQa = interaction?.type === 'q_and_a';
  const isQuiz = interaction?.type === 'quiz';
  const isSurvey = interaction?.type === 'survey';

  const survey = isSurvey ? await getSurveyDetail(interaction.id) : null;
  const surveyAnswers = isSurvey
    ? await getSurveyAnswers(interaction.id, participant.id)
    : {};

  const quizView = isQuiz
    ? await getParticipantQuizView(interaction.id, participant.id)
    : null;
  // The board is only on screen between questions and at the end, so it is
  // only read then: not in the lobby, and not while a question is open,
  // which is when every phone refetches at once. A phone shows the top of
  // the board and its own place, read directly rather than found in a list
  // that would otherwise have to hold every player.
  const boardShown =
    quizView !== null && quizView.phase !== 'lobby' && quizView.phase !== 'question';
  const [leaderboard, standing] =
    isQuiz && interaction && boardShown
      ? await Promise.all([
          getLeaderboard(interaction.id, PHONE_BOARD_SIZE),
          getPlayerStanding(interaction.id, participant.id),
        ])
      : [[], null];

  const questions = isQa
    ? await listQuestions({
        interactionId: interaction.id,
        participantId: participant.id,
        isHost: false,
      })
    : [];

  const mine =
    interaction && !isQa && !isQuiz && !isSurvey
      ? await getParticipantResponses(interaction.id, participant.id)
      : [];

  const results =
    interaction &&
    !isQa &&
    !isQuiz &&
    !isSurvey &&
    (interaction.settings.showResultsToParticipants ?? false)
      ? await getInteractionResults(interaction)
      : null;

  const maxEntries = interaction
    ? maxEntriesFor(interaction.type, interaction.settings)
    : 0;

  // Results are held back until this participant has answered, so early
  // responses cannot steer the people who answer after them.
  const answered = mine.length > 0;
  const showResults = Boolean(results) && answered;

  /**
   * What this phone does not need to hear about.
   *
   * A phone shows nothing about who else has joined, and during a quiz
   * nothing about anyone else's answer. Refetching the page for each of
   * those makes every player's tap cost a page render on every other
   * player's phone, which is what falls over in a full room. A poll that
   * shows live results is the exception: there, other people's answers are
   * on screen.
   */
  const liveResults = interaction?.settings.showResultsToParticipants ?? false;
  const ignore = liveResults
    ? [RealtimeEvent.ParticipantJoined]
    : [
        RealtimeEvent.ParticipantJoined,
        RealtimeEvent.ResponseCreated,
        RealtimeEvent.ResponseUpdated,
      ];

  const mySelections = mine.flatMap((entry) =>
    entry.data.kind === 'multiple_choice' ? entry.data.optionIds : [],
  );
  const myRating = mine.find(
    (entry): entry is { slot: number; data: Extract<ResponseData, { kind: 'rating' }> } =>
      entry.data.kind === 'rating',
  )?.data.value;
  const myOrder =
    mine.find((entry) => entry.data.kind === 'ranking')?.data.kind === 'ranking'
      ? (mine.find((entry) => entry.data.kind === 'ranking')!.data as Extract<
          ResponseData,
          { kind: 'ranking' }
        >).optionIds
      : [];

  const myTexts = mine.flatMap((entry) => {
    if (entry.data.kind === 'word_cloud') return [entry.data.word];
    if (entry.data.kind === 'open_text') return [entry.data.text];
    return [];
  });

  return (
    <div className={cn('flex min-h-dvh flex-col', branding && 'brand-backdrop')}>
      <BrandStyle branding={branding} />
      {/* Keeps this player counted as in the room while the page is open. */}
      <Presence eventId={event.id} />
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <BrandLogo
            branding={branding}
            title={event.title}
            className="h-9 max-w-24 shrink-0"
            fallback={<Logo showWordmark={false} />}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{event.title}</p>
            {/* One line: beside a wide logo the code would otherwise break in two. */}
            <p className="truncate whitespace-nowrap font-mono text-xs text-muted-foreground">
              {event.eventCode}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="flex flex-col items-end gap-0.5">
              <LiveIndicator eventId={event.id} withQa ignore={ignore} />
              {participant.displayName && (
                <span className="text-xs text-muted-foreground">
                  {participant.displayName}
                </span>
              )}
            </div>
            {/* A participant may be handed a code in a room where the screen
                is in another language than the one they read. */}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {!interaction ? (
          <EmptyState
            icon={MessageSquareDashed}
            title={t('noActiveTitle')}
            description={t('noActiveBody')}
          />
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold leading-snug">{interaction.title}</h1>
              {interaction.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {interaction.description}
                </p>
              )}
            </div>

            {isQuiz && quizView ? (
              <QuizPanel
                key={quizView.question?.id ?? 'none'}
                view={quizView}
                leaderboard={leaderboard}
                standing={standing}
                participantId={participant.id}
                eventId={event.id}
                displayName={participant.displayName}
                serverNow={serverNow()}
              />
            ) : isSurvey && survey ? (
              <SurveyPanel survey={survey} answers={surveyAnswers} />
            ) : isQa ? (
              <QaPanel
                interactionId={interaction.id}
                settings={interaction.settings}
                questions={questions}
              />
            ) : (
              <Card className="p-5">
                <AnswerForm
                  interactionId={interaction.id}
                  type={interaction.type}
                  settings={interaction.settings}
                  options={interaction.options}
                  mySelections={mySelections}
                  myRating={myRating}
                  myTexts={myTexts}
                  myOrder={myOrder}
                  entriesLeft={Math.max(maxEntries - mine.length, 0)}
                />
              </Card>
            )}

            {showResults && results && (
              <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
                  {t('liveResults')}
                </h2>
                <ResultsView
                  results={results}
                  myOptionIds={mySelections}
                  myRating={myRating}
                />
              </Card>
            )}
          </div>
        )}
      </main>

      <PartnerLogos
        branding={branding}
        className="justify-center px-4 pb-6"
        logoClassName="h-7"
      />
    </div>
  );
}
