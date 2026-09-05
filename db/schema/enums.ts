import { pgEnum } from 'drizzle-orm/pg-core';

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'live',
  'ended',
  'archived',
]);

export const memberRoleEnum = pgEnum('member_role', ['owner', 'editor', 'viewer']);

export const interactionTypeEnum = pgEnum('interaction_type', [
  'multiple_choice',
  'word_cloud',
  'rating',
  'open_text',
  'ranking',
  'q_and_a',
  'quiz',
  'survey',
]);

export const interactionStatusEnum = pgEnum('interaction_status', [
  'draft',
  'active',
  'closed',
]);

export const questionStatusEnum = pgEnum('question_status', [
  'pending',
  'approved',
  'answered',
  'hidden',
  'archived',
]);
