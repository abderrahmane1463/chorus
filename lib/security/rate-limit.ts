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
  /** Password guesses against one account, from anywhere. */
  signInPerAccount: { limit: 10, windowMs: 15 * 60_000 },
  /** Password guesses from one address, across accounts. */
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

/** Whether a try would be refused now, without spending one. */
export function exhausted(rule: RuleName, subject: string): boolean {
  const bucket = buckets.get(`${rule}:${subject}`);
  return bucket ? refilled(bucket, RULES[rule], Date.now()) < 1 : false;
}

/**
 * The address a request came from.
 *
 * Behind the host's proxy the connection itself always comes from the
 * proxy, so the client is the first address in X-Forwarded-For, which that
 * proxy sets. Only meaningful behind a proxy that overwrites the header; a
 * client talking to Node directly could put anything there, which would
 * let it pick its own bucket but not raise its limit.
 */
export function clientAddress(source: Headers): string {
  const forwarded = source.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || source.get('x-real-ip') || 'local';
}

/** The calling request's address, from inside a Server Action. */
export async function callerAddress(): Promise<string> {
  return clientAddress(await headers());
}
