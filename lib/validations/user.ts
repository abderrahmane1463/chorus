import { z } from 'zod';

/**
 * Messages are translation keys, not sentences.
 *
 * The same schema validates in the browser and again on the server, and each
 * side resolves the key with the reader's language: `t(message)`.
 */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'validation.nameTooShort').max(80),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const joinEventSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'validation.codeRequired')
    .max(20, 'validation.codeTooLong'),
  displayName: z.string().trim().max(60).optional(),
});

export type JoinEventInput = z.infer<typeof joinEventSchema>;

/** A name chosen after joining, for a quiz scoreboard that would otherwise say "Anonymous". */
export const nicknameSchema = z.object({
  eventId: z.string().uuid(),
  displayName: z
    .string()
    .trim()
    .min(1, 'validation.nicknameRequired')
    .max(30, 'validation.nicknameTooLong'),
});
