'use client';

import { useEffect, useRef } from 'react';
import type { QuizPhase } from '@/lib/quiz/pacing';

/**
 * Sound for the projector during a quiz.
 *
 * Every sound is a few sine tones generated in the browser. There are no
 * audio files: nothing to load, nothing to license, and it works offline.
 */

type Tone = {
  frequency: number;
  /** Seconds the tone lasts. */
  length: number;
  /** Seconds after the sound starts that this tone begins. */
  at?: number;
  /** 0 to 1. Kept low: this plays through a room's speakers. */
  volume?: number;
};

const SOUNDS = {
  // A player arrives in the lobby.
  join: [{ frequency: 660, length: 0.09, volume: 0.12 }],
  // One per second of "get ready".
  ready: [{ frequency: 440, length: 0.12, volume: 0.16 }],
  // One per second of the last five.
  tick: [{ frequency: 880, length: 0.06, volume: 0.14 }],
  // The buzzer: two falling notes.
  timeUp: [
    { frequency: 392, length: 0.18, volume: 0.2 },
    { frequency: 294, length: 0.32, at: 0.18, volume: 0.2 },
  ],
  // The answer appears: two rising notes.
  reveal: [
    { frequency: 523, length: 0.14, volume: 0.2 },
    { frequency: 784, length: 0.3, at: 0.14, volume: 0.2 },
  ],
  // The podium: a rising arpeggio.
  podium: [
    { frequency: 523, length: 0.16, volume: 0.2 },
    { frequency: 659, length: 0.16, at: 0.16, volume: 0.2 },
    { frequency: 784, length: 0.16, at: 0.32, volume: 0.2 },
    { frequency: 1047, length: 0.5, at: 0.48, volume: 0.22 },
  ],
} satisfies Record<string, Tone[]>;

type SoundName = keyof typeof SOUNDS;

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  }
  return audio;
}

function play(name: SoundName) {
  const ctx = context();
  if (!ctx) return;

  // Browsers keep audio suspended until the page has been interacted with.
  // On the projector that is the host pressing Start, which comes before any
  // sound that matters. Until then these calls are silent, not errors.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  const start = ctx.currentTime;
  for (const tone of SOUNDS[name] as Tone[]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const from = start + (tone.at ?? 0);
    const to = from + tone.length;

    oscillator.type = 'sine';
    oscillator.frequency.value = tone.frequency;
    // A short fade in and out, so tones do not click at their edges.
    gain.gain.setValueAtTime(0, from);
    gain.gain.linearRampToValueAtTime(tone.volume ?? 0.15, from + 0.01);
    gain.gain.linearRampToValueAtTime(0, to);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(from);
    oscillator.stop(to + 0.02);
  }
}

/**
 * Plays the quiz's sounds as the run moves.
 *
 * Each sound marks a change, so every effect compares against the previous
 * value and stays silent on the first render: opening the projector in the
 * middle of a question must not replay everything that led up to it.
 */
export function useQuizSounds({
  enabled,
  phase,
  startsIn,
  remaining,
  playerCount,
  onPodium,
}: {
  enabled: boolean;
  phase: QuizPhase;
  /** Seconds until the question opens; null when there is no clock. */
  startsIn: number | null;
  /** Seconds left on the question; null when there is no clock. */
  remaining: number | null;
  playerCount: number;
  /** Whether the final standings are showing. */
  onPodium: boolean;
}) {
  const previous = useRef<{
    phase: QuizPhase;
    startsIn: number | null;
    remaining: number | null;
    playerCount: number;
    onPodium: boolean;
  } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = { phase, startsIn, remaining, playerCount, onPodium };

    if (!enabled || !before) return;

    if (phase === 'lobby' && playerCount > before.playerCount) play('join');

    if (phase === 'question') {
      const open = startsIn === 0;

      if (!open && startsIn !== null && startsIn !== before.startsIn) play('ready');

      if (open && remaining !== null && remaining !== before.remaining) {
        if (remaining === 0) play('timeUp');
        else if (remaining <= 5) play('tick');
      }
    }

    if (phase === 'revealed' && before.phase === 'question') play('reveal');
    if (onPodium && !before.onPodium) play('podium');
  }, [enabled, phase, startsIn, remaining, playerCount, onPodium]);
}
