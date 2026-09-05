import { z } from 'zod';

export const eventStatuses = ['draft', 'live', 'ended', 'archived'] as const;

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Give your event a title')
    .max(120, 'Title must be 120 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or fewer')
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
