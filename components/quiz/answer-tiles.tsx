import { cn } from '@/lib/utils/cn';

/**
 * The look of a quiz answer: a letter on a block of colour.
 *
 * The projector and the phones draw the same answer with the same letter and
 * colour, so a player can find "C, the violet one" on their phone without
 * reading the text again. The letter carries the meaning on its own; colour
 * only reinforces it, for players who cannot tell the colours apart.
 *
 * Every background is dark enough for white text at AA contrast.
 */
const TILES = [
  { letter: 'A', surface: 'bg-teal-700', chart: 'bg-teal-600' },
  { letter: 'B', surface: 'bg-amber-700', chart: 'bg-amber-600' },
  { letter: 'C', surface: 'bg-violet-700', chart: 'bg-violet-600' },
  { letter: 'D', surface: 'bg-rose-700', chart: 'bg-rose-600' },
  { letter: 'E', surface: 'bg-sky-700', chart: 'bg-sky-600' },
  { letter: 'F', surface: 'bg-lime-800', chart: 'bg-lime-700' },
] as const;

export type AnswerTile = (typeof TILES)[number];

/** The tile for the answer at this position. A quiz question has at most six. */
export function tileFor(index: number): AnswerTile {
  return TILES[index % TILES.length];
}

/** The letter in its badge, as shown on a tile and beside a chart bar. */
export function TileLetter({
  index,
  size = 'md',
  className,
}: {
  index: number;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      // Letters are Latin in every language, so they keep their own direction.
      dir="ltr"
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-white/20 font-bold text-white',
        size === 'lg' ? 'size-14 text-3xl' : 'size-9 text-lg',
        className,
      )}
    >
      {tileFor(index).letter}
    </span>
  );
}
