/**
 * Reduces a word-cloud entry to a comparison key.
 *
 * "Growth ", "growth" and "Growth!" must all land on the same bar, so the key
 * lowercases, collapses inner whitespace and strips edge punctuation. The
 * original spelling is stored alongside and used for display.
 */
export function normalizeWord(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}
