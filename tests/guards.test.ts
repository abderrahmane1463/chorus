import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  clientAddress,
  exhausted,
  passwordBuckets,
  RULES,
  take,
  type RuleName,
} from '@/lib/security/rate-limit';
import { messageKey } from '@/lib/validations/message';
import { acceptsAudience } from '@/lib/utils/event-status';
import { toCsv } from '@/lib/utils/csv';

test('the rate limit allows the burst, then refuses', () => {
  const subject = `test-${Math.random()}`;
  const { limit } = RULES.signInPerAccount;

  for (let i = 0; i < limit; i++) assert.equal(take('signInPerAccount', subject), true, `try ${i + 1}`);
  assert.equal(exhausted('signInPerAccount', subject), true);
  assert.equal(take('signInPerAccount', subject), false);
});

test('one subject running out does not touch another', () => {
  const a = `test-${Math.random()}`;
  const b = `test-${Math.random()}`;
  while (take('questionPerPlayer', a));
  assert.equal(take('questionPerPlayer', b), true);
});

test('checking a limit does not spend a try', () => {
  const subject = `test-${Math.random()}`;
  for (let i = 0; i < 100; i++) exhausted('signUpPerAddress', subject);
  assert.equal(take('signUpPerAddress', subject), true);
});

test('the client address is the last public hop, which a client cannot forge', () => {
  const from = (xff: string) => clientAddress(new Headers({ 'x-forwarded-for': xff }));
  // The proxy appended the real address after a value the client made up.
  assert.equal(from('1.2.3.4, 203.0.113.7'), '203.0.113.7');
  // A chain of the host's own proxies is skipped.
  assert.equal(from('203.0.113.7, 127.0.0.1'), '203.0.113.7');
  assert.equal(from('6.6.6.6, 203.0.113.7, 10.0.0.2, ::ffff:127.0.0.1'), '203.0.113.7');
  // Rotating the made-up part never changes the key.
  assert.equal(from('9.9.9.9, 203.0.113.7'), from('8.8.8.8, 203.0.113.7'));
  // Only internal hops (local development): the nearest to the client.
  assert.equal(from('192.168.1.20, 127.0.0.1'), '192.168.1.20');
  assert.equal(clientAddress(new Headers({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4');
  assert.equal(clientAddress(new Headers()), 'local');
});

test('password limits are per account and address, so a stranger cannot lock the owner out', () => {
  const email = `owner-${Math.random()}@example.test`;
  const attacker = passwordBuckets(email, '203.0.113.66');
  const owner = passwordBuckets(email, '198.51.100.10');
  const fail = (buckets: Array<[RuleName, string]>) => buckets.forEach(([r, s]) => take(r, s));
  const blocked = (buckets: Array<[RuleName, string]>) => buckets.some(([r, s]) => exhausted(r, s));

  for (let i = 0; i < RULES.signInPerAccountAddress.limit; i++) fail(attacker);
  assert.equal(blocked(attacker), true, 'the guesser is stopped');
  assert.equal(blocked(owner), false, 'the owner, from their own address, is not');
});

test('only translation keys pass through as messages', () => {
  const keyed = z.object({ name: z.string().min(2, 'validation.nameTooShort') });
  const bare = z.object({ name: z.string().max(3) });

  const keyedError = keyed.safeParse({ name: 'a' }).error!;
  const bareError = bare.safeParse({ name: 'abcdef' }).error!;

  assert.equal(messageKey(keyedError, 'validation.fallback'), 'validation.nameTooShort');
  // zod's own English sentence is not shown; the fallback is.
  assert.equal(messageKey(bareError, 'validation.fallback'), 'validation.fallback');
});

test('only ended and archived events turn the audience away', () => {
  assert.equal(acceptsAudience('draft'), true);
  assert.equal(acceptsAudience('live'), true);
  assert.equal(acceptsAudience('ended'), false);
  assert.equal(acceptsAudience('archived'), false);
});

test('participant text cannot become a spreadsheet formula', () => {
  const csv = toCsv(['answer'], [['=HYPERLINK("http://example.com")'], ['+1'], ['-2'], ['@cmd'], ['plain']]);
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n');

  assert.equal(lines[1], `"'=HYPERLINK(""http://example.com"")"`);
  assert.equal(lines[2], `'+1`);
  assert.equal(lines[3], `'-2`);
  assert.equal(lines[4], `'@cmd`);
  assert.equal(lines[5], 'plain');
});
