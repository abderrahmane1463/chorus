import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { interactions } from './interactions';
import { participants } from './participants';
import type { ResponseData } from '@/types/interactions';

/**
 * One submitted answer.
 *
 * `slot` is what makes "one answer per person" a database guarantee rather than
 * a hopeful application check. Single-answer interactions always write slot 0,
 * so the unique constraint rejects a second row. Interactions that legitimately
 * accept several answers per person (word clouds) increment the slot instead.
 */
export const responses = pgTable(
  'responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interactionId: uuid('interaction_id')
      .notNull()
      .references(() => interactions.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    slot: integer('slot').notNull().default(0),
    responseData: jsonb('response_data').$type<ResponseData>().notNull(),
    // Hosts can moderate open-text walls without destroying the raw data.
    hidden: boolean('hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('responses_slot_unique').on(
      table.interactionId,
      table.participantId,
      table.slot,
    ),
    index('responses_interaction_idx').on(table.interactionId, table.createdAt),
    index('responses_participant_idx').on(table.participantId),
  ],
);

export const responsesRelations = relations(responses, ({ one }) => ({
  interaction: one(interactions, {
    fields: [responses.interactionId],
    references: [interactions.id],
  }),
  participant: one(participants, {
    fields: [responses.participantId],
    references: [participants.id],
  }),
}));
