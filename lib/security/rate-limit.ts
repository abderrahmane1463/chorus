import 'server-only';
import { headers } from 'next/headers';

/**
 * Limits how often one person can do one thing.
 *
 * Kept in this process's memory. The live site runs as a single Node
 * process, so the counts there are exact. On a host that runs several
 * copies (the Vercel backup), each copy counts on its own, which still
 * slows a script down but lets a determined one through more often.
 *
 * Each key holds a bucket of tokens that refills steadily: `limit` actions
 * are allowed at once, then one more each `windowMs / limit`. A person who
 * stays under the rate never notices it; a script hammering a form runs
 * dry in seconds.
 */

type Rule = { limit: number; windowMs: number };
type Bucket = { tokens: number; updatedAt: number };

/** The limits, by what they protect. */
export const RULES = {
  /**
   * Wrong passwords for one account from one address. Only failures count,
   * and the address is part of the key, so someone guessing from elsewhere
   * never locks the owner out of their own account.
   */
  signInPerAccountAddress: { limit: 10, windowMs: 15 * 60_000 },
  /**
   * Wrong passwords for one account from anywhere. Wide on purpose: it only
   * slows guessing spread over many addresses, which the per-address limits
   * cannot see.
   */
  signInPerAccount: { limit: 50, windowMs: 60 * 60_000 },
  /** Wrong passwords from one address, across accounts. */
  signInPerAddress: { limit: 30, windowMs: 15 * 60_000 },
  /** New host accounts from one address. */
  signUpPerAddress: { limit: 5, windowMs: 60 * 60_000 },
  /**
   * Joins from one address. Generous on purpose: a whole room joins from
   * the venue's one Wi-Fi address, so this only stops a script creating
   * players by the thousand.
   */
  joinPerAddress: { limit: 600, windowMs: 10 * 60_000 },
  /** Q&A questions from one player. */
  questionPerPlayer: { limit: 5, windowMs: 60_000 },
  /** Upvotes, answers and renames from one player. */
  actionPerPlayer: { limit: 40, windowMs: 60_000 },
  /** Presence signals from one player; a phone sends two a minute. */
  presencePerPlayer: { limit: 10, windowMs: 60_000 },
  /** Image uploads from one host. */
  uploadPerHost: { limit: 30, windowMs: 10 * 60_000 },
} satisfies Record<string, Rule>;

export type RuleName = keyof typeof RULES;

// Survives hot reloads in development, which would otherwise reset counts.
const store = globalThis as unknown as { __rateLimits?: Map<string, Bucket> };
const buckets = (store.__rateLimits ??= new Map<string, Bucket>());

/** Buckets this full and this old are forgotten, so memory stays bounded. */
const SWEEP_EVERY = 1000;
let sinceSweep = 0;

function refilled(bucket: Bucket, rule: Rule, now: number): number {
  const perMs = rule.limit / rule.windowMs;
  return Math.min(rule.limit, bucket.tokens + (now - bucket.updatedAt) * perMs);
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    const rule = RULES[key.slice(0, key.indexOf(':')) as RuleName];
    if (!rule || refilled(bucket, rule, now) >= rule.limit) buckets.delete(key);
  }
}

/**
 * Spends one try. False when there is none left: the caller should refuse
 * the action, without having done any of its work.
 */
export function take(rule: RuleName, subject: string): boolean {
  const now = Date.now();
  const key = `${rule}:${subject}`;
  const limits = RULES[rule];

  if (++sinceSweep >= SWEEP_EVERY) {
    sinceSweep = 0;
    sweep(now);
  }

  const bucket = buckets.get(key) ?? { tokens: limits.limit, updatedAt: now };
  const tokens = refilled(bucket, limits, now);

  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now });
    return false;
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return true;
}

/**
 * The buckets a password attempt counts against: one account from one
 * address, one account from anywhere, and one address across accounts.
 */
export function passwordBuckets(email: string, address: string): Array<[RuleName, string]> {
  return [
    ['signInPerAccountAddress', `${email}|${address}`],
    ['signInPerAccount', email],
    ['signInPerAddress', address],
  ];
}

/** Whether a try would be refused now, without spending one. */
export function exhausted(rule: RuleName, subject: string): boolean {
  const bucket = buckets.get(`${rule}:${subject}`);
  return bucket ? refilled(bucket, RULES[rule], Date.now()) < 1 : false;
}

/**
 * Loopback, private and link-local addresses: the host's own proxies, never
 * a visitor seen from the internet.
 */
function isInternalAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^::ffff:/, '');
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return ip === '::1' || ip === '::' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
}

/**
 * The address a request came from.
 *
 * Every proxy in front of the app appends the address it received the
 * connection from to X-Forwarded-For, after whatever the client itself sent.
 * So the list is read from the right: the first address that is not one of
 * the host's own proxies is the one the internet-facing proxy saw, which a
 * client cannot forge. Anything a client puts in the header sits to its left
 * and is ignored. This holds however many proxies the host chains.
 */
export function clientAddress(source: Headers): string {
  const hops = (source.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isInternalAddress(hops[i])) return hops[i];
  }
  // Only internal hops (a local or private-network setup): the one nearest
  // the client is the best guess there is.
  return hops[0] || source.get('x-real-ip')?.trim() || 'local';
}

/** The calling request's address, from inside a Server Action. */
export async function callerAddress(): Promise<string> {
  return clientAddress(await headers());
}
