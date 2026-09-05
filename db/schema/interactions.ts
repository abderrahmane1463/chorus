import { relations } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { events } from './events';
import { interactionStatusEnum, interactionTypeEnum } from './enums';
import type { InteractionSettings } from '@/types/interactions';

/**
 * One interaction = one thing the audience does.
 *
 * Quizzes and surveys are containers: their individual questions are child
 * rows pointing back via `parentId`, which lets them reuse the same options,
 * responses and settings machinery as standalone interactions.
 */
export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => interactions.id, {
      onDelete: 'cascade',
    }),
    type: interactionTypeEnum('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    status: interactionStatusEnum('status').notNull().default('draft'),
    settings: jsonb('settings').$type<InteractionSettings>().notNull().default({}),

    // Runtime state for quizzes and surveys.
    currentChildId: uuid('current_child_id'),
    answerRevealed: boolean('answer_revealed').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('interactions_event_idx').on(table.eventId, table.position),
    index('interactions_parent_idx').on(table.parentId, table.position),
  ],
);

export const interactionOptions = pgTable(
  'interaction_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interactionId: uuid('interaction_id')
      .notNull()
      .references(() => interactions.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    imageUrl: text('image_url'),
    position: integer('position').notNull().default(0),
    // Only meaningful for quiz questions.
    isCorrect: boolean('is_correct'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('interaction_options_idx').on(table.interactionId, table.position)],
);

export const interactionsRelations = relations(interactions, ({ one, many }) => ({
  event: one(events, { fields: [interactions.eventId], references: [events.id] }),
  parent: one(interactions, {
    fields: [interactions.parentId],
    references: [interactions.id],
    relationName: 'children',
  }),
  children: many(interactions, { relationName: 'children' }),
  options: many(interactionOptions),
}));

export const interactionOptionsRelations = relations(interactionOptions, ({ one }) => ({
  interaction: one(interactions, {
    fields: [interactionOptions.interactionId],
    references: [interactions.id],
  }),
}));
