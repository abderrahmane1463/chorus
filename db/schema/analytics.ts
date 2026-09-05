import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';
import { participants } from './participants';

/** Append-only activity log backing the analytics page. */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id').references(() => participants.id, {
      onDelete: 'set null',
    }),
    eventType: text('event_type').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('analytics_event_idx').on(table.eventId, table.createdAt),
    index('analytics_type_idx').on(table.eventId, table.eventType),
  ],
);
