import 'server-only';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, interactionOptions, interactions, responses } from '@/db/schema';
import type { InteractionSettings, ResponseData } from '@/types/interactions';

export type InteractionListItem = {
  id: string;
  type: string;
  title: string;
  status: 'draft' | 'active' | 'closed';
  position: number;
  responseCount: number;
};

/** Top-level interactions for an event, in presentation order. */
export async function listInteractions(
  eventId: string,
): Promise<InteractionListItem[]> {
  const rows = await db
    .select({
      id: interactions.id,
      type: interactions.type,
      title: interactions.title,
      status: interactions.status,
      position: interactions.position,
      responseCount: count(responses.id),
    })
    .from(interactions)
    .leftJoin(responses, eq(responses.interactionId, interactions.id))
    .where(and(eq(interactions.eventId, eventId), isNull(interactions.parentId)))
    .groupBy(interactions.id)
    .orderBy(asc(interactions.position), asc(interactions.createdAt));

  return rows;
}

export type InteractionDetail = {
  id: string;
  eventId: string;
  type: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
  settings: InteractionSettings;
  options: { id: string; text: string; position: number }[];
};

/** Loads an interaction, enforcing that the requesting host owns its event. */
export async function getInteractionForOwner(
  interactionId: string,
  userId: string,
): Promise<InteractionDetail | null> {
  const [row] = await db
    .select({
      id: interactions.id,
      eventId: interactions.eventId,
      type: interactions.type,
      title: interactions.title,
      description: interactions.description,
      status: interactions.status,
      settings: interactions.settings,
    })
    .from(interactions)
    .innerJoin(events, eq(events.id, interactions.eventId))
    .where(and(eq(interactions.id, interactionId), eq(events.ownerId, userId)))
    .limit(1);

  if (!row) return null;

  const options = await db
    .select({
      id: interactionOptions.id,
      text: interactionOptions.text,
      position: interactionOptions.position,
    })
    .from(interactionOptions)
    .where(eq(interactionOptions.interactionId, interactionId))
    .orderBy(asc(interactionOptions.position));

  return { ...row, options };
}

const INTERACTION_FIELDS = {
  id: interactions.id,
  eventId: interactions.eventId,
  type: interactions.type,
  title: interactions.title,
  description: interactions.description,
  status: interactions.status,
  settings: interactions.settings,
};

/** The interaction the audience should currently see, if any. */
export async function getActiveInteraction(
  eventId: string,
): Promise<InteractionDetail | null> {
  const [active] = await db
    .select(INTERACTION_FIELDS)
    .from(interactions)
    .where(
      and(
        eq(interactions.eventId, eventId),
        eq(interactions.status, 'active'),
        isNull(interactions.parentId),
      ),
    )
    .orderBy(asc(interactions.position))
    .limit(1);

  // A finished quiz stays on screen so the room can read the final
  // leaderboard, until the host opens something else.
  const row =
    active ??
    (
      await db
        .select(INTERACTION_FIELDS)
        .from(interactions)
        .innerJoin(events, eq(events.activeInteractionId, interactions.id))
        .where(and(eq(events.id, eventId), eq(interactions.type, 'quiz')))
        .limit(1)
    )[0];

  if (!row) return null;

  const options = await db
    .select({
      id: interactionOptions.id,
      text: interactionOptions.text,
      position: interactionOptions.position,
    })
    .from(interactionOptions)
    .where(eq(interactionOptions.interactionId, row.id))
    .orderBy(asc(interactionOptions.position));

  return { ...row, options };
}

export type InteractionResults =
  | {
      kind: 'multiple_choice';
      total: number;
      options: { id: string; text: string; votes: number; share: number }[];
    }
  | {
      kind: 'rating';
      total: number;
      average: number;
      distribution: { value: number; count: number }[];
    }
  | { kind: 'word_cloud'; total: number; words: { word: string; count: number }[] }
  | {
      kind: 'ranking';
      total: number;
      options: {
        id: string;
        text: string;
        averagePosition: number;
        rank: number;
      }[];
    }
  | {
      kind: 'open_text';
      total: number;
      entries: { id: string; text: string; hidden: boolean; createdAt: Date }[];
    }
  | { kind: 'none'; total: number };

/**
 * Aggregates raw responses into whatever the interaction type needs to render.
 * Done in application code rather than SQL because the payloads are JSONB and
 * the result sets are small enough that clarity beats cleverness here.
 */
export async function getInteractionResults(
  interaction: Pick<InteractionDetail, 'id' | 'type' | 'settings'> & {
    options?: { id: string; text: string }[];
  },
): Promise<InteractionResults> {
  const rows = await db
    .select({
      id: responses.id,
      data: responses.responseData,
      hidden: responses.hidden,
      createdAt: responses.createdAt,
    })
    .from(responses)
    .where(eq(responses.interactionId, interaction.id))
    .orderBy(asc(responses.createdAt));

  switch (interaction.type) {
    case 'multiple_choice': {
      const tally = new Map<string, number>();
      let total = 0;

      for (const row of rows) {
        const data = row.data as Extract<ResponseData, { kind: 'multiple_choice' }>;
        if (!Array.isArray(data?.optionIds)) continue;
        total += 1;
        for (const optionId of data.optionIds) {
          tally.set(optionId, (tally.get(optionId) ?? 0) + 1);
        }
      }

      // Percentages are of total votes cast, so a multi-select poll can exceed 100%.
      const totalVotes = [...tally.values()].reduce((sum, n) => sum + n, 0);

      return {
        kind: 'multiple_choice',
        total,
        options: (interaction.options ?? []).map((option) => {
          const votes = tally.get(option.id) ?? 0;
          return {
            id: option.id,
            text: option.text,
            votes,
            share: totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100),
          };
        }),
      };
    }

    case 'rating': {
      const min = interaction.settings.scaleMin ?? 1;
      const max = interaction.settings.scaleMax ?? 5;
      const counts = new Map<number, number>();
      let sum = 0;
      let total = 0;

      for (const row of rows) {
        const data = row.data as Extract<ResponseData, { kind: 'rating' }>;
        if (typeof data?.value !== 'number') continue;
        total += 1;
        sum += data.value;
        counts.set(data.value, (counts.get(data.value) ?? 0) + 1);
      }

      const distribution = [];
      for (let value = min; value <= max; value++) {
        distribution.push({ value, count: counts.get(value) ?? 0 });
      }

      return {
        kind: 'rating',
        total,
        average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10,
        distribution,
      };
    }

    case 'word_cloud': {
      // Group by the normalized form, but display the most common original
      // spelling so the cloud reads naturally rather than all-lowercase.
      const groups = new Map<string, Map<string, number>>();
      let total = 0;

      for (const row of rows) {
        const data = row.data as Extract<ResponseData, { kind: 'word_cloud' }>;
        if (!data?.normalized) continue;
        total += 1;
        const variants = groups.get(data.normalized) ?? new Map<string, number>();
        variants.set(data.word, (variants.get(data.word) ?? 0) + 1);
        groups.set(data.normalized, variants);
      }

      const words = [...groups.entries()]
        .map(([, variants]) => {
          let best = '';
          let bestCount = 0;
          let count = 0;
          for (const [variant, n] of variants) {
            count += n;
            if (n > bestCount) {
              best = variant;
              bestCount = n;
            }
          }
          return { word: best, count };
        })
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));

      return { kind: 'word_cloud', total, words };
    }

    case 'ranking': {
      // Each response is an ordered list. An option's score is its mean
      // position across every submission, so lower is better.
      const totals = new Map<string, { sum: number; count: number }>();
      let total = 0;

      for (const row of rows) {
        const data = row.data as Extract<ResponseData, { kind: 'ranking' }>;
        if (!Array.isArray(data?.optionIds)) continue;
        total += 1;
        data.optionIds.forEach((optionId, index) => {
          const entry = totals.get(optionId) ?? { sum: 0, count: 0 };
          entry.sum += index + 1;
          entry.count += 1;
          totals.set(optionId, entry);
        });
      }

      const scored = (interaction.options ?? []).map((option) => {
        const entry = totals.get(option.id);
        return {
          id: option.id,
          text: option.text,
          // Unranked options sort last rather than appearing to be first.
          averagePosition: entry && entry.count > 0
            ? Math.round((entry.sum / entry.count) * 100) / 100
            : Number.POSITIVE_INFINITY,
        };
      });

      scored.sort((a, b) => a.averagePosition - b.averagePosition);

      return {
        kind: 'ranking',
        total,
        options: scored.map((option, index) => ({
          ...option,
          averagePosition: Number.isFinite(option.averagePosition)
            ? option.averagePosition
            : 0,
          rank: index + 1,
        })),
      };
    }

    case 'open_text': {
      const entries = rows
        .map((row) => {
          const data = row.data as Extract<ResponseData, { kind: 'open_text' }>;
          return typeof data?.text === 'string'
            ? {
                id: row.id,
                text: data.text,
                hidden: row.hidden,
                createdAt: row.createdAt,
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .reverse();

      return { kind: 'open_text', total: entries.length, entries };
    }

    default:
      return { kind: 'none', total: rows.length };
  }
}

/** What this participant has already submitted, so the UI can show their answer. */
export async function getParticipantResponses(
  interactionId: string,
  participantId: string,
): Promise<{ slot: number; data: ResponseData }[]> {
  const rows = await db
    .select({ slot: responses.slot, data: responses.responseData })
    .from(responses)
    .where(
      and(
        eq(responses.interactionId, interactionId),
        eq(responses.participantId, participantId),
      ),
    )
    .orderBy(asc(responses.slot));

  return rows.map((row) => ({ slot: row.slot, data: row.data }));
}
