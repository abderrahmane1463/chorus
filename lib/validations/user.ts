import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const joinEventSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Enter the event code')
    .max(20, 'That code is too long'),
  displayName: z.string().trim().max(60).optional(),
});

export type JoinEventInput = z.infer<typeof joinEventSchema>;
