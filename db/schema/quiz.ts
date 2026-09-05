import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { interactions } from './interactions';
import { participants } from './participants';

/** Running tally for one participant in one quiz. Recomputed as answers land. */
export const quizScores = pgTable(
  'quiz_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => interactions.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(0),
    correctAnswers: integer('correct_answers').notNull().default(0),
    // Milliseconds spent answering, used to break ties.
    totalTime: integer('total_time').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('quiz_scores_unique').on(table.quizId, table.participantId),
    index('quiz_scores_leaderboard_idx').on(table.quizId, table.score),
  ],
);

export const quizScoresRelations = relations(quizScores, ({ one }) => ({
  quiz: one(interactions, {
    fields: [quizScores.quizId],
    references: [interactions.id],
  }),
  participant: one(participants, {
    fields: [quizScores.participantId],
    references: [participants.id],
  }),
}));
