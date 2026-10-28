import { lookup as dnsLookup, Resolver, type LookupAddress } from 'node:dns';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Agent, fetch as undiciFetch } from 'undici';
import * as schema from '@/db/schema';

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 120;
/** How long a DNS answer may take before the last good one is used instead. */
const LOOKUP_TIMEOUT_MS = 1_500;

/** The last addresses each database host resolved to. */
const knownAddresses = new Map<string, LookupAddress[]>();

/** Public resolvers, asked alongside the server's own. */
const publicResolver = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 2 });
publicResolver.setServers(['8.8.8.8', '1.1.1.1']);

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * Resolves the database host to IPv4, falling back to its last good answer.
 *
 * Some resolvers on the server's network intermittently answer the database
 * host with no IPv4 address, or slowly, and IPv6 does not route there at all.
 * A failed lookup made a host's click hang, then fail. So public resolvers
 * are asked at the same time and the first real answer wins; if none comes,
 * the last good one stands in, as the database's addresses rarely change.
 */
function lookup(
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
) {
  let settled = false;
  let pending = 2;
  let lastError: NodeJS.ErrnoException | null = null;
  const answer = (addresses: LookupAddress[]) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  };
  const fallBack = (error: NodeJS.ErrnoException) => {
    if (settled) return;
    const known = knownAddresses.get(hostname);
    if (known) answer(known);
    else {
      settled = true;
      callback(error, '');
    }
  };

  const resolved = (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => {
    if (!error && addresses.length > 0) {
      knownAddresses.set(hostname, addresses);
      answer(addresses);
      return;
    }
    lastError = error ?? Object.assign(new Error(`No address for ${hostname}`), { code: 'ENOTFOUND' });
    // Neither source answered: no point waiting out the timer.
    if (--pending === 0) fallBack(lastError);
  };

  const timer = setTimeout(
    () => fallBack(lastError ?? Object.assign(new Error(`DNS lookup timed out: ${hostname}`), { code: 'ETIMEOUT' })),
    LOOKUP_TIMEOUT_MS * 2,
  );
  dnsLookup(hostname, { family: 4, all: true }, (error, addresses) => resolved(error, addresses ?? []));
  publicResolver.resolve4(hostname, (error, addresses) =>
    resolved(error, (addresses ?? []).map((address) => ({ address, family: 4 }))),
  );
}

/**
 * Connections to the database, kept open between queries.
 *
 * The route to the database loses packets, so every new connection risks a
 * lookup and a handshake that stall. Reused for up to a minute, a host
 * clicking through an event rarely opens one. When one is needed, each of the
 * database's addresses gets a second before the next is tried.
 */
const agent = new Agent({
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 600_000,
  connect: {
    timeout: 8_000,
    lookup,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 1_000,
  },
});

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
      return (await undiciFetch(input as Parameters<typeof undiciFetch>[0], {
        ...(init as Parameters<typeof undiciFetch>[1]),
        dispatcher: agent,
      })) as unknown as Response;
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
