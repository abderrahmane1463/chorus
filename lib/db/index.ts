import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 120;

/**
 * A network-level failure, as opposed to a database error.
 *
 * Neon's HTTP driver surfaces a dropped connection as a bare `TypeError:
 * fetch failed` with no SQL state. Those are safe to retry; a real query error
 * comes back as a response and must not be.
 */
function isTransient(error: unknown): boolean {
  return error instanceof TypeError && /fetch failed|network|socket/i.test(error.message);
}

/**
 * Retries transient connection failures.
 *
 * Long-lived Node processes reuse keep-alive sockets, and a socket the remote
 * has already closed fails on first use. One retry almost always lands; the
 * backoff covers the rarer case of a brief network blip.
 */
neonConfig.fetchFunction = async (input: RequestInfo | URL, init?: RequestInit) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === MAX_ATTEMPTS) break;
      await new Promise((resolve) =>
        setTimeout(resolve, BASE_BACKOFF_MS * 2 ** (attempt - 1)),
      );
    }
  }

  throw lastError;
};

let client: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Builds the client on first query, not at import time.
 *
 * Next evaluates route modules while collecting page data during `next build`,
 * where DATABASE_URL is often absent. Connecting eagerly would fail the whole
 * build; this way a missing variable surfaces as a clear runtime error on the
 * first request instead.
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Add it to your environment (Vercel project settings, or .env.local locally).',
      );
    }
    client = drizzle(neon(connectionString), { schema });
  }
  return client;
}

/** Drizzle client over Neon's HTTP driver — no long-lived connections, so it
 *  suits serverless deployment targets like Vercel. */
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});

export { schema };
