import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import {
  getActiveInteraction,
  getInteractionResults,
  listInteractions,
} from '@/lib/queries/interactions';
import { getTopQuestions } from '@/lib/queries/questions';
import { getLeaderboard, getQuizDetail } from '@/lib/queries/quiz';
import { getSurveyDetail } from '@/lib/queries/survey';
import { PresenterScreen } from '@/components/present/presenter-screen';

export const metadata: Metadata = { title: 'Presenter' };

export default async function PresentPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;

  const event = await getEventForOwner(eventId, user.id);
  if (!event) notFound();

  const interactions = await listInteractions(event.id);
  const active = await getActiveInteraction(event.id);

  const results =
    active && active.type !== 'q_and_a' && active.type !== 'quiz'
      ? await getInteractionResults(active)
      : null;

  const questions =
    active?.type === 'q_and_a' ? await getTopQuestions(active.id) : [];

  const quiz = active?.type === 'quiz' ? await getQuizDetail(active.id) : null;
  const leaderboard = quiz ? await getLeaderboard(quiz.id, 8) : [];

  const survey = active?.type === 'survey' ? await getSurveyDetail(active.id) : null;

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <PresenterScreen
      eventId={event.id}
      eventTitle={event.title}
      eventCode={event.eventCode}
      joinUrl={`${origin}/event/${event.eventCode}`}
      participantCount={event.participantCount}
      interactions={interactions}
      active={active}
      results={results}
      questions={questions}
      quiz={quiz}
      leaderboard={leaderboard}
      survey={survey}
    />
  );
}
