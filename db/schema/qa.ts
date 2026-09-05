import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { events } from './events';
import { interactions } from './interactions';
import { participants } from './participants';
import { questionStatusEnum } from './enums';

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // Which Q&A interaction this belongs to; an event can run more than one.
    interactionId: uuid('interaction_id').references(() => interactions.id, {
      onDelete: 'cascade',
    }),
    // Null when the participant record is gone but the question is kept.
    participantId: uuid('participant_id').references(() => participants.id, {
      onDelete: 'set null',
    }),
    text: text('text').notNull(),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    status: questionStatusEnum('status').notNull().default('approved'),
    // Highlighted on the presenter screen.
    isHighlighted: boolean('is_highlighted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('questions_event_idx').on(table.eventId, table.createdAt),
    index('questions_status_idx').on(table.eventId, table.status),
  ],
);

export const questionVotes = pgTable(
  'question_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('question_votes_unique').on(table.questionId, table.participantId),
    index('question_votes_question_idx').on(table.questionId),
  ],
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  event: one(events, { fields: [questions.eventId], references: [events.id] }),
  participant: one(participants, {
    fields: [questions.participantId],
    references: [participants.id],
  }),
  votes: many(questionVotes),
}));

export const questionVotesRelations = relations(questionVotes, ({ one }) => ({
  question: one(questions, {
    fields: [questionVotes.questionId],
    references: [questions.id],
  }),
}));
