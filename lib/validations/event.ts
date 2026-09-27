import { z } from 'zod';

// Translation keys, resolved with t(message) where they are displayed.

export const eventStatuses = ['draft', 'live', 'ended', 'archived'] as const;

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'validation.titleRequired')
    .max(120, 'validation.titleTooLong'),
  description: z
    .string()
    .trim()
    .max(500, 'validation.descriptionTooLong')
    .optional()
    .or(z.literal('')),
});

export const updateEventSchema = createEventSchema.extend({
  eventId: z.string().uuid(),
});

export const updateEventStatusSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(eventStatuses),
});

export const eventIdSchema = z.object({
  eventId: z.string().uuid(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
