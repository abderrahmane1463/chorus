/**
 * When each scene plays, in seconds. Every scene reads its own window from
 * here, so the film's pacing is tuned in one place.
 *
 * Neighbouring scenes overlap by a moment: the next one starts arriving
 * while the last one leaves, which is what lets one shot grow out of the
 * one before instead of cutting to it.
 */
export const SCENES = {
  intro: { from: 0, to: 4.6 },
  event: { from: 4.3, to: 10.8 },
  flow: { from: 10.4, to: 18.7 },
  participant: { from: 18.3, to: 28.7 },
  live: { from: 28.4, to: 36.8 },
  organizer: { from: 36.4, to: 43.8 },
  bigPicture: { from: 43.5, to: 48.9 },
  brand: { from: 48.5, to: 54 },
} as const;

export type SceneName = keyof typeof SCENES;

/** The film's length. It loops from here back to the start. */
export const DURATION = SCENES.brand.to;

/** Chapter marks for the progress bar, in order. */
export const CHAPTERS: { name: SceneName; at: number }[] = (
  Object.entries(SCENES) as [SceneName, { from: number }][]
).map(([name, { from }]) => ({ name, at: Math.max(0, from) }));

/**
 * The frame shown instead of the film when motion is reduced, or before it
 * starts: the closing brand shot, which says what Chorus is on its own.
 */
export const POSTER_TIME = 52;

/** The two compositions: a wide stage, and a tall one for phones. */
export type Layout = 'wide' | 'tall';

export const STAGE = {
  wide: { width: 1600, height: 900 },
  tall: { width: 900, height: 1200 },
} as const;
