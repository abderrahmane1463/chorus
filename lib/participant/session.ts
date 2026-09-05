import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'chorus_participant';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.PARTICIPANT_COOKIE_SECRET;
  if (!value) {
    throw new Error('PARTICIPANT_COOKIE_SECRET is not set. See .env.example.');
  }
  return value;
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

/**
 * Participant identity is a signed random id in a cookie.
 *
 * Signing matters: the id decides whose vote is whose, so a participant must
 * not be able to hand-craft a cookie and impersonate another session or vote
 * twice by editing a value the client controls.
 */
function serialize(id: string): string {
  return `${id}.${sign(id)}`;
}

function verify(raw: string | undefined): string | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;

  const id = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = sign(id);

  // Constant-time compare so a signature cannot be guessed byte by byte.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return id;
}

/** Reads the current participant session id, or null when there isn't one. */
export async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  return verify(store.get(COOKIE_NAME)?.value);
}

/**
 * Returns the participant session id, creating and persisting one if needed.
 * Only callable from a Server Action or Route Handler, where cookies are writable.
 */
export async function ensureSessionId(): Promise<string> {
  const existing = await readSessionId();
  if (existing) return existing;

  const id = randomBytes(16).toString('base64url');
  const store = await cookies();
  store.set(COOKIE_NAME, serialize(id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: usesHttps(),
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  return id;
}

/**
 * Whether to mark the cookie `secure`.
 *
 * Keyed off the public URL rather than NODE_ENV: a production build served
 * over plain HTTP (a LAN demo, an internal host, a proxy terminating TLS
 * elsewhere) would otherwise set a secure cookie that the browser silently
 * discards, so participants would join and be logged straight back out.
 */
function usesHttps(): boolean {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (url) return url.startsWith('https://');
  return process.env.NODE_ENV === 'production';
}
