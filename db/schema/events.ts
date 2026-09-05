import { relations } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { eventStatusEnum, memberRoleEnum } from './enums';

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    // Human-friendly join code, e.g. MARKETING26. Stored uppercase.
    eventCode: text('event_code').notNull().unique(),
    status: eventStatusEnum('status').notNull().default('draft'),
    // The interaction currently pushed to the audience. Intentionally not a
    // foreign key: a circular events <-> interactions constraint complicates
    // delete ordering, so this is cleared in application code instead.
    activeInteractionId: uuid('active_interaction_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_owner_idx').on(table.ownerId, table.createdAt),
    index('events_status_idx').on(table.status),
  ],
);

export const eventMembers = pgTable(
  'event_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('event_members_unique').on(table.eventId, table.userId),
    index('event_members_user_idx').on(table.userId),
  ],
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  owner: one(users, { fields: [events.ownerId], references: [users.id] }),
  members: many(eventMembers),
}));

export const eventMembersRelations = relations(eventMembers, ({ one }) => ({
  event: one(events, { fields: [eventMembers.eventId], references: [events.id] }),
  user: one(users, { fields: [eventMembers.userId], references: [users.id] }),
}));
