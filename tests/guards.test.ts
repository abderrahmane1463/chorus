import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { clientAddress, exhausted, RULES, take } from '@/lib/security/rate-limit';
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

test('the client address is the first one the proxy forwarded', () => {
  assert.equal(clientAddress(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })), '203.0.113.7');
  assert.equal(clientAddress(new Headers({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4');
  assert.equal(clientAddress(new Headers()), 'local');
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
