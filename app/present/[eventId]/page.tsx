import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import {
  getActiveInteraction,
  getInteractionResults,
  listInteractions,
} from '@/lib/queries/interactions';
import { getTopQuestions } from '@/lib/queries/questions';
import {
  getLeaderboard,
  getLobbyPlayers,
  getQuizDetail,
  quizTiming,
} from '@/lib/queries/quiz';
import { getSurveyDetail } from '@/lib/queries/survey';
import { PresenterScreen } from '@/components/present/presenter-screen';
import { serverNow } from '@/lib/utils/server-time';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('presenter');
  return { title: t('metaTitle') };
}

export default async function PresentPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;

  const event = await getEventForOwner(eventId, user.id);
  if (!event) notFound();

  const [interactions, active] = await Promise.all([
    listInteractions(event.id),
    getActiveInteraction(event.id),
  ]);

  const results =
    active && active.type !== 'q_and_a' && active.type !== 'quiz'
      ? await getInteractionResults(active)
      : null;

  const questions =
    active?.type === 'q_and_a' ? await getTopQuestions(active.id) : [];

  const quiz = active?.type === 'quiz' ? await getQuizDetail(active.id) : null;
  // After a reveal, also ask who moved on the question just answered.
  const leaderboard = quiz
    ? await getLeaderboard(
        quiz.id,
        8,
        quiz.answerRevealed ? quiz.currentChildId : null,
      )
    : [];

  const survey = active?.type === 'survey' ? await getSurveyDetail(active.id) : null;

  const timing = quiz
    ? quizTiming(quiz, leaderboard.length > 0)
    : { phase: 'idle' as const, dueAt: null };

  // Names are only shown while the room is filling, so only fetched then.
  const lobby =
    quiz && timing.phase === 'lobby'
      ? await getLobbyPlayers(event.id)
      : { players: [], total: event.participantCount };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <PresenterScreen
      eventId={event.id}
      eventTitle={event.title}
      eventCode={event.eventCode}
      joinUrl={`${origin}/event/${event.eventCode}`}
      participantCount={lobby.total}
      players={lobby.players}
      quizPhase={timing.phase}
      quizDueAt={timing.dueAt}
      interactions={interactions}
      active={active}
      results={results}
      questions={questions}
      quiz={quiz}
      leaderboard={leaderboard}
      survey={survey}
      serverNow={serverNow()}
    />
  );
}
