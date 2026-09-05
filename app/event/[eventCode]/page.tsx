import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { MessageSquareDashed } from 'lucide-react';
import { db } from '@/lib/db';
import { events, participants } from '@/db/schema';
import { readSessionId } from '@/lib/participant/session';
import { normalizeEventCode } from '@/lib/utils/event-code';
import {
  getActiveInteraction,
  getInteractionResults,
  getParticipantResponses,
} from '@/lib/queries/interactions';
import { maxEntriesFor } from '@/lib/interactions/registry';
import { EmptyState } from '@/components/shared/empty-state';
import { Logo } from '@/components/shared/logo';
import { AnswerForm } from '@/components/participant/answer-form';
import { QaPanel } from '@/components/participant/qa-panel';
import { listQuestions } from '@/lib/queries/questions';
import { QuizPanel } from '@/components/participant/quiz-panel';
import { getLeaderboard, getParticipantQuizView } from '@/lib/queries/quiz';
import { SurveyPanel } from '@/components/participant/survey-panel';
import { getSurveyAnswers, getSurveyDetail } from '@/lib/queries/survey';
import { ResultsView } from '@/components/interactions/results-view';
import { LiveIndicator } from '@/components/shared/live-indicator';
import { Card } from '@/components/ui/card';
import type { ResponseData } from '@/types/interactions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;
  const [event] = await db
    .select({ title: events.title })
    .from(events)
    .where(eq(events.eventCode, normalizeEventCode(eventCode)))
    .limit(1);

  return { title: event?.title ?? 'Event' };
}

export default async function ParticipantEventPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;
  const code = normalizeEventCode(eventCode);

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      eventCode: events.eventCode,
      status: events.status,
    })
    .from(events)
    .where(eq(events.eventCode, code))
    .limit(1);

  if (!event) notFound();

  // Without a joined session there is nobody to attribute answers to.
  const sessionId = await readSessionId();
  if (!sessionId) redirect(`/join?code=${encodeURIComponent(code)}`);

  const [participant] = await db
    .select({ id: participants.id, displayName: participants.displayName })
    .from(participants)
    .where(
      and(eq(participants.eventId, event.id), eq(participants.sessionId, sessionId)),
    )
    .limit(1);

  if (!participant) redirect(`/join?code=${encodeURIComponent(code)}`);

  const interaction = await getActiveInteraction(event.id);
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
  const leaderboard = isQuiz && interaction ? await getLeaderboard(interaction.id) : [];

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
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Logo showWordmark={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{event.title}</p>
            <p className="font-mono text-xs text-muted-foreground">{event.eventCode}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <LiveIndicator eventId={event.id} withQa />
            {participant.displayName && (
              <span className="text-xs text-muted-foreground">
                {participant.displayName}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {!interaction ? (
          <EmptyState
            icon={MessageSquareDashed}
            title="No interaction is currently active"
            description="When the host opens a poll, a question or a quiz, it will appear here."
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
                participantId={participant.id}
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
                  Live results
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
    </div>
  );
}
