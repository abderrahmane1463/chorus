import type { z } from 'zod';

/**
 * The translation key to show for a failed validation.
 *
 * Schemas carry translation keys as their messages, so each side can say it
 * in the reader's language. A rule written without one (a bare `.max(300)`)
 * carries zod's own English sentence instead, which is not a key and would
 * show up as English, or as a missing-message warning, in any language. Only
 * real keys are passed on; anything else becomes the given fallback.
 */
export function messageKey(error: z.ZodError, fallback: string): string {
  const message = error.issues[0]?.message;
  return message && /^(validation|errors)\.[A-Za-z]+$/.test(message) ? message : fallback;
}
