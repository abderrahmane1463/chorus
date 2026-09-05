/**
 * Event codes are read off a screen and typed on a phone, so the alphabet
 * excludes characters that are easy to confuse: I/1, O/0, and similar.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

function pick(source: string): string {
  return source[Math.floor(Math.random() * source.length)];
}

/** Generates a code like "BRAVO-42": four letters, a dash, then two digits. */
export function generateEventCode(): string {
  const letters = Array.from({ length: 4 }, () => pick(ALPHABET)).join('');
  const digits = Array.from({ length: 2 }, () => pick(DIGITS)).join('');
  return `${letters}-${digits}`;
}

/** Accepts what a human typed and returns the canonical stored form. */
export function normalizeEventCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

const CODE_PATTERN = /^[A-Z0-9-]{4,20}$/;

export function isValidEventCode(input: string): boolean {
  return CODE_PATTERN.test(normalizeEventCode(input));
}
