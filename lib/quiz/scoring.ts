export const DEFAULT_QUIZ_POINTS = 1000;
export const DEFAULT_TIME_LIMIT_SECONDS = 20;

/** A late answer is still accepted for this long, to absorb network latency. */
export const ANSWER_GRACE_MS = 1500;

export type ScoreInput = {
  correct: boolean;
  /** Milliseconds between the question opening and the answer arriving. */
  elapsedMs: number;
  timeLimitSeconds: number;
  basePoints: number;
  speedBonus: boolean;
};

/**
 * Points for one quiz answer.
 *
 * A wrong answer scores nothing. A correct answer earns the base points, and
 * with the speed bonus on, half the base is fixed and half decays linearly
 * with the time taken — so answering instantly is worth double answering at
 * the buzzer, without making a slow correct answer worthless.
 */
export function computeScore({
  correct,
  elapsedMs,
  timeLimitSeconds,
  basePoints,
  speedBonus,
}: ScoreInput): number {
  if (!correct) return 0;
  if (!speedBonus) return basePoints;

  const limitMs = Math.max(timeLimitSeconds, 1) * 1000;
  const clamped = Math.min(Math.max(elapsedMs, 0), limitMs);
  const remaining = 1 - clamped / limitMs;

  return Math.round(basePoints * (0.5 + 0.5 * remaining));
}

/** True when the chosen options exactly match the correct ones. */
export function isAnswerCorrect(
  chosenIds: string[],
  correctIds: string[],
): boolean {
  if (correctIds.length === 0) return false;
  if (chosenIds.length !== correctIds.length) return false;

  const chosen = new Set(chosenIds);
  return correctIds.every((id) => chosen.has(id));
}
