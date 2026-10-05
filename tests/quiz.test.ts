import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, isAnswerCorrect } from '@/lib/quiz/scoring';
import { nextDueAt, quizPacing, quizPhase } from '@/lib/quiz/pacing';

const base = { timeLimitSeconds: 20, basePoints: 1000, speedBonus: true };

test('a wrong answer scores nothing, however fast', () => {
  assert.equal(computeScore({ ...base, correct: false, elapsedMs: 0 }), 0);
});

test('with the speed bonus, an instant answer is worth double one at the buzzer', () => {
  assert.equal(computeScore({ ...base, correct: true, elapsedMs: 0 }), 1000);
  assert.equal(computeScore({ ...base, correct: true, elapsedMs: 20_000 }), 500);
  assert.equal(computeScore({ ...base, correct: true, elapsedMs: 10_000 }), 750);
});

test('a time outside the question is clamped, never negative or above the base', () => {
  assert.equal(computeScore({ ...base, correct: true, elapsedMs: -500 }), 1000);
  assert.equal(computeScore({ ...base, correct: true, elapsedMs: 99_000 }), 500);
});

test('without the speed bonus every correct answer earns the base points', () => {
  assert.equal(computeScore({ ...base, speedBonus: false, correct: true, elapsedMs: 19_000 }), 1000);
});

test('an answer is correct only when it picks exactly the right options', () => {
  assert.equal(isAnswerCorrect(['a'], ['a']), true);
  assert.equal(isAnswerCorrect(['c', 'a'], ['a', 'c']), true);
  // Picking every option must not count as getting the two right.
  assert.equal(isAnswerCorrect(['a', 'b', 'c'], ['a', 'c']), false);
  assert.equal(isAnswerCorrect(['a'], ['a', 'c']), false);
  // A question with no correct answer cannot be answered correctly.
  assert.equal(isAnswerCorrect([], []), false);
});

test('the phase follows the quiz state', () => {
  const at = (status: 'draft' | 'active' | 'closed', current: boolean, revealed: boolean, scores = false) =>
    quizPhase({ status, hasCurrentQuestion: current, answerRevealed: revealed, hasScores: scores });

  assert.equal(at('active', false, false), 'lobby');
  assert.equal(at('active', true, false), 'question');
  assert.equal(at('active', true, true), 'revealed');
  assert.equal(at('closed', false, true, true), 'finished');
  assert.equal(at('closed', false, true, false), 'idle');
  assert.equal(at('draft', false, false), 'idle');
});

test('pacing settings fall back to defaults and stay within bounds', () => {
  assert.deepEqual(quizPacing({}), { autoAdvance: true, revealSeconds: 10 });
  assert.equal(quizPacing({ revealSeconds: 1 }).revealSeconds, 3);
  assert.equal(quizPacing({ revealSeconds: 999 }).revealSeconds, 60);
});

test('the next step falls due at the buzzer, then after the reveal pause', () => {
  const pacing = quizPacing({});
  const startedAt = new Date(1_000_000);

  assert.equal(
    nextDueAt({ pacing, phase: 'question', startedAt, revealedAt: null, timeLimitSeconds: 20 }),
    1_000_000 + 20_000,
  );
  assert.equal(
    nextDueAt({ pacing, phase: 'revealed', startedAt, revealedAt: new Date(2_000_000), timeLimitSeconds: 20 }),
    2_000_000 + 10_000,
  );
  // The lobby waits for the host's Start.
  assert.equal(nextDueAt({ pacing, phase: 'lobby', startedAt: null, revealedAt: null, timeLimitSeconds: 20 }), null);
  // Paced by hand, nothing ever falls due on its own.
  assert.equal(
    nextDueAt({ pacing: { ...pacing, autoAdvance: false }, phase: 'question', startedAt, revealedAt: null, timeLimitSeconds: 20 }),
    null,
  );
});
