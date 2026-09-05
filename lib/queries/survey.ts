import 'server-only';
import { and, asc, countDistinct, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, interactionOptions, interactions, responses } from '@/db/schema';
import { getInteractionResults, type InteractionResults } from './interactions';
import type { InteractionSettings } from '@/types/interactions';
export { SURVEY_CHILD_TYPES, type SurveyChildType } from '@/lib/interactions/registry';

export type SurveyQuestion = {
  id: string;
  type: string;
  title: string;
  position: number;
  settings: InteractionSettings;
  options: { id: string; text: string; position: number }[];
  results: InteractionResults;
};

export type SurveyDetail = {
  id: string;
  eventId: string;
  title: string;
  status: 'draft' | 'active' | 'closed';
  settings: InteractionSettings;
  questions: SurveyQuestion[];
  /** Participants who answered at least one question. */
  startedCount: number;
  /** Participants who answered every question. */
  completedCount: number;
};

export async function getSurveyDetail(surveyId: string): Promise<SurveyDetail | null> {
  const [survey] = await db
    .select({
      id: interactions.id,
      eventId: interactions.eventId,
      title: interactions.title,
      status: interactions.status,
      settings: interactions.settings,
      type: interactions.type,
    })
    .from(interactions)
    .where(eq(interactions.id, surveyId))
    .limit(1);

  if (!survey || survey.type !== 'survey') return null;

  const children = await db
    .select({
      id: interactions.id,
      type: interactions.type,
      title: interactions.title,
      position: interactions.position,
      settings: interactions.settings,
    })
    .from(interactions)
    .where(eq(interactions.parentId, surveyId))
    .orderBy(asc(interactions.position), asc(interactions.createdAt));

  const questions: SurveyQuestion[] = [];

  for (const child of children) {
    const options = await db
      .select({
        id: interactionOptions.id,
        text: interactionOptions.text,
        position: interactionOptions.position,
      })
      .from(interactionOptions)
      .where(eq(interactionOptions.interactionId, child.id))
      .orderBy(asc(interactionOptions.position));

    questions.push({
      ...child,
      options,
      results: await getInteractionResults({ ...child, options }),
    });
  }

  const childIds = questions.map((question) => question.id);

  // Completion is counted per participant: how many distinct questions each
  // has answered, compared against the number of questions in the survey.
  let startedCount = 0;
  let completedCount = 0;

  if (childIds.length > 0) {
    const perParticipant = await db
      .select({
        participantId: responses.participantId,
        answered: countDistinct(responses.interactionId),
      })
      .from(responses)
      .where(inArray(responses.interactionId, childIds))
      .groupBy(responses.participantId);

    startedCount = perParticipant.length;
    completedCount = perParticipant.filter(
      (row) => Number(row.answered) >= childIds.length,
    ).length;
  }

  return {
    id: survey.id,
    eventId: survey.eventId,
    title: survey.title,
    status: survey.status,
    settings: survey.settings,
    questions,
    startedCount,
    completedCount,
  };
}

/** What one participant has answered so far, keyed by question id. */
export async function getSurveyAnswers(
  surveyId: string,
  participantId: string,
): Promise<Record<string, { optionIds: string[]; value?: number; text?: string }>> {
  const childIds = (
    await db
      .select({ id: interactions.id })
      .from(interactions)
      .where(eq(interactions.parentId, surveyId))
  ).map((row) => row.id);

  if (childIds.length === 0) return {};

  const rows = await db
    .select({ interactionId: responses.interactionId, data: responses.responseData })
    .from(responses)
    .where(
      and(
        inArray(responses.interactionId, childIds),
        eq(responses.participantId, participantId),
      ),
    );

  const answers: Record<string, { optionIds: string[]; value?: number; text?: string }> =
    {};

  for (const row of rows) {
    const data = row.data;
    if (data.kind === 'multiple_choice') {
      answers[row.interactionId] = { optionIds: data.optionIds };
    } else if (data.kind === 'rating') {
      answers[row.interactionId] = { optionIds: [], value: data.value };
    } else if (data.kind === 'open_text') {
      answers[row.interactionId] = { optionIds: [], text: data.text };
    }
  }

  return answers;
}

export async function assertSurveyOwner(surveyId: string, userId: string) {
  const [row] = await db
    .select({ id: interactions.id, eventId: interactions.eventId })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(and(eq(interactions.id, surveyId), eq(events.ownerId, userId)))
    .limit(1);

  return row ?? null;
}
