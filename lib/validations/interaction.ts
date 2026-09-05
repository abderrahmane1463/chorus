import { z } from 'zod';

export const creatableTypes = [
  'multiple_choice',
  'word_cloud',
  'rating',
  'open_text',
  'q_and_a',
  'quiz',
  'ranking',
  'survey',
] as const;

const optionSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().trim().min(1, 'Options cannot be empty').max(160),
});

export const interactionSettingsSchema = z.object({
  allowMultiple: z.boolean().optional(),
  maxSelections: z.number().int().min(1).max(10).optional(),
  allowChangeAnswer: z.boolean().optional(),
  showResultsToParticipants: z.boolean().optional(),
  maxEntriesPerParticipant: z.number().int().min(1).max(5).optional(),
  scaleMin: z.number().int().min(0).max(1).optional(),
  scaleMax: z.number().int().min(3).max(10).optional(),
  minLabel: z.string().trim().max(40).optional(),
  maxLabel: z.string().trim().max(40).optional(),
  maxLength: z.number().int().min(20).max(1000).optional(),
  allowMultipleSubmissions: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  moderationEnabled: z.boolean().optional(),
  allowUpvotes: z.boolean().optional(),
  timeLimitSeconds: z.number().int().min(5).max(180).optional(),
  points: z.number().int().min(100).max(5000).optional(),
  speedBonus: z.boolean().optional(),
  explanation: z.string().trim().max(300).optional(),
  navigationMode: z.enum(['one_by_one', 'all_at_once']).optional(),
});

export const createInteractionSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(creatableTypes),
});

export const updateInteractionSchema = z.object({
  interactionId: z.string().uuid(),
  title: z.string().trim().min(1, 'Add a question').max(300),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  settings: interactionSettingsSchema,
  options: z.array(optionSchema).max(10).optional(),
});

export const interactionIdSchema = z.object({
  interactionId: z.string().uuid(),
});

export const setInteractionStatusSchema = z.object({
  interactionId: z.string().uuid(),
  status: z.enum(['draft', 'active', 'closed']),
});

export const reorderInteractionsSchema = z.object({
  eventId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).max(100),
});

export type UpdateInteractionInput = z.infer<typeof updateInteractionSchema>;

/**
 * Participant submissions. The shape is validated per interaction type on the
 * server, because the client is never trusted to say what kind of answer it is.
 */
export const submitResponseSchema = z.object({
  interactionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).max(10).optional(),
  value: z.number().optional(),
  text: z.string().max(1000).optional(),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
