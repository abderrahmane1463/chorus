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

/**
 * Public links to an event's report.
 *
 * Anyone holding the token can read the sections it names until it expires
 * or the host switches it off. The token is long and random, so links cannot
 * be guessed; nothing else about the event is reachable through one.
 */
export const analyticsShares = pgTable(
  'analytics_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    sections: jsonb('sections').$type<string[]>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('analytics_shares_event_idx').on(table.eventId)],
);
