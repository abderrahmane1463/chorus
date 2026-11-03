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

/** Whether visitors accept a statement before joining, and in whose words. */
export const eventConsentSchema = z.object({
  eventId: z.string().uuid(),
  enabled: z.boolean(),
  text: z.string().trim().max(600).optional().or(z.literal('')),
});

/** The thanks a kiosk tablet shows after each visitor; empty keeps Chorus's. */
export const eventKioskSchema = z.object({
  eventId: z.string().uuid(),
  thanks: z.string().trim().max(120).optional().or(z.literal('')),
  thanksBody: z.string().trim().max(200).optional().or(z.literal('')),
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
