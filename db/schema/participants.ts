import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';

/**
 * An anonymous audience member. Identity is a signed session id held in a
 * cookie, so a participant survives refreshes without ever creating an account.
 */
export const participants = pgTable(
  'participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    displayName: text('display_name'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('participants_session_unique').on(table.eventId, table.sessionId),
    index('participants_event_idx').on(table.eventId, table.lastSeenAt),
  ],
);

export const participantsRelations = relations(participants, ({ one }) => ({
  event: one(events, { fields: [participants.eventId], references: [events.id] }),
}));
