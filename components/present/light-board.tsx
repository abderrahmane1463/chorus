'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Sparkles, Undo2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { revealInteractionAction } from '@/lib/actions/interaction';

/** The dark of the room the lights appear in, whatever the page's theme. */
const NIGHT = '#06080c';
/** How long the lights take to gather into the text, and the stagger between them. */
const GATHER_MS = 2200;
const STAGGER_MS = 700;
/** How long a new light takes to bloom. */
const BLOOM_MS = 900;
/** The plan B fills the room in this long before it reveals. */
const SIMULATION_MS = 6000;

type Point = { x: number; y: number; tx: number; ty: number; born: number; phase: number };

/** A stable pseudo-random number in [0, 1) for a light, so it keeps its place. */
function noise(i: number, salt: number) {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The places the text's letters cover, sampled on a grid: where the lights
 * gather when the host reveals.
 */
function sampleText(text: string, width: number, height: number, font: string) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { spots: [], size: 0, lines: [text] };
  let size = Math.min(height * 0.32, 160);
  ctx.font = `700 ${size}px ${font}`;
  // Two lines when one would be too small to read from the back of the room.
  const words = text.split(/\s+/);
  let lines = [text];
  while (ctx.measureText(lines.reduce((a, b) => (a.length > b.length ? a : b))).width > width * 0.86 && size > 24) {
    if (lines.length === 1 && words.length > 1) {
      const half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
    } else {
      size -= 4;
      ctx.font = `700 ${size}px ${font}`;
    }
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = size * 1.15;
  const firstY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, k) => ctx.fillText(line, width / 2, firstY + k * lineHeight));

  const data = ctx.getImageData(0, 0, width, height).data;
  const step = Math.max(3, Math.round(size / 18));
  const spots: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 128) spots.push({ x, y });
    }
  }
  // The size and lines go with the spots, so the text shown over the lights
  // is set exactly where they gathered.
  return { spots, size, lines };
}

/**
 * A collective lighting on the big screen.
 *
 * The room is dark; each phone that lights up adds a point of light, which
 * blooms where it lands and keeps its place. On the reveal every light flies
 * to a letter of the chosen text, and the text itself glows in once they have
 * gathered. Without the phones, the plan B fills the room and reveals on its
 * own, the same picture with nobody connected.
 */
export function LightBoard({
  interactionId,
  title,
  text,
  total,
  target,
  revealed,
  autoReveal,
}: {
  interactionId: string;
  title: string;
  /** What the lights gather into. */
  text: string;
  /** How many phones have lit up. */
  total: number;
  /** How many lights the room is waiting for. */
  target: number;
  revealed: boolean;
  autoReveal: boolean;
}) {
  const t = useTranslations('presenter');
  const reduceMotion = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [simulated, setSimulated] = useState<number | null>(null);
  const [localReveal, setLocalReveal] = useState(false);
  const [pending, startTransition] = useTransition();
  const askedReveal = useRef(false);
  const [layout, setLayout] = useState<{ size: number; lines: string[] } | null>(null);

  const count = Math.max(total, simulated ?? 0);
  const shown = revealed || localReveal;

  // What the draw loop reads each frame, kept current without restarting it.
  const live = useRef({ count, shown, revealedAt: 0 });
  useEffect(() => {
    if (shown && !live.current.shown) live.current.revealedAt = performance.now();
    live.current.count = count;
    live.current.shown = shown;
  }, [count, shown]);

  // The board fills the height between its top and the footer.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const top = box.getBoundingClientRect().top + window.scrollY;
      const footer = document.querySelector('footer')?.getBoundingClientRect().height ?? 0;
      setHeight(Math.max(320, window.innerHeight - footer - top - 32));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // The draw loop: one canvas, every light, every frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box || !height) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = box.clientWidth;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const styles = getComputedStyle(box);
    const color = styles.getPropertyValue('--primary').trim() || '#16a394';
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const { spots, size, lines } = sampleText(text, width, height, font);
    setLayout({ size, lines });
    // Spread over the letters: each light takes its own spot, in a shuffled order.
    const order = spots.map((_, i) => i).sort((a, b) => noise(a, 7) - noise(b, 7));

    const points: Point[] = [];
    const place = (i: number): Point => {
      const spot = spots.length ? spots[order[i % order.length]] : { x: width / 2, y: height / 2 };
      return {
        x: 40 + noise(i, 1) * (width - 80),
        y: 40 + noise(i, 2) * (height - 80),
        tx: spot.x,
        ty: spot.y,
        born: performance.now(),
        phase: noise(i, 3) * Math.PI * 2,
      };
    };

    const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    let frame = 0;

    const draw = (now: number) => {
      const { count: n, shown: isShown, revealedAt } = live.current;
      while (points.length < n) points.push(place(points.length));
      if (points.length > n) points.length = n;

      ctx.fillStyle = NIGHT;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      const since = isShown ? now - revealedAt : 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const bloom = reduceMotion ? 1 : Math.min(1, (now - p.born) / BLOOM_MS);
        const delay = (i / Math.max(points.length, 1)) * STAGGER_MS;
        const k = isShown ? (reduceMotion ? 1 : ease(Math.min(1, Math.max(0, (since - delay) / GATHER_MS)))) : 0;
        const x = p.x + (p.tx - p.x) * k;
        const y = p.y + (p.ty - p.y) * k;
        const twinkle = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(now / 600 + p.phase);
        // Sized for a projector seen from the back of a ballroom.
        const r = (isShown ? 3 : 4.5) * (0.4 + 0.6 * bloom);

        // A soft halo, then the bright core; a new light flares as it blooms.
        const flare = 1 + (1 - bloom) * 3;
        const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7 * flare);
        halo.addColorStop(0, color);
        halo.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.55 * twinkle * bloom;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, r * 7 * flare, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [height, text, reduceMotion]);

  const setRevealed = useCallback(
    (value: boolean) => {
      startTransition(async () => {
        const result = await revealInteractionAction({ interactionId, revealed: value });
        if (!result.ok) toast.error(result.error);
      });
    },
    [interactionId],
  );

  // Reveals by itself once the room has reached its target, if asked to.
  useEffect(() => {
    if (!autoReveal || revealed || askedReveal.current || total < target) return;
    askedReveal.current = true;
    setRevealed(true);
  }, [autoReveal, revealed, total, target, setRevealed]);

  // Plan B: the room fills on its own, then reveals, here only.
  function simulate() {
    if (simulated !== null) return;
    const from = total;
    const started = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - started) / SIMULATION_MS);
      setSimulated(Math.round(from + (target - from) * k));
      if (k < 1) requestAnimationFrame(tick);
      else setTimeout(() => setLocalReveal(true), 600);
    };
    requestAnimationFrame(tick);
  }

  function reset() {
    setSimulated(null);
    setLocalReveal(false);
    askedReveal.current = false;
    if (revealed) setRevealed(false);
  }

  // A clicker or a keyboard: R reveals or puts the lights back, S plays plan B.
  const keys = useRef({ shown, reveal: () => setRevealed(true), reset, simulate });
  useEffect(() => {
    keys.current = { shown, reveal: () => setRevealed(true), reset, simulate };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if ((event.target as Element | null)?.closest?.('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if (key === 'r') (keys.current.shown ? keys.current.reset : keys.current.reveal)();
      if (key === 's') keys.current.simulate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative overflow-hidden rounded-2xl"
      style={{ height: height ?? undefined, background: NIGHT }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0" />

      {/* The text itself glows in once the lights have gathered on it. */}
      {shown && (
        <p
          aria-live="polite"
          aria-label={text}
          className="light-reveal pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center font-bold whitespace-nowrap text-white"
          style={{
            fontSize: layout?.size,
            lineHeight: 1.15,
            animationDelay: reduceMotion ? '0ms' : `${GATHER_MS + STAGGER_MS}ms`,
          }}
        >
          {(layout?.lines ?? [text]).map((line) => (
            <span key={line} aria-hidden>
              {line}
            </span>
          ))}
        </p>
      )}

      {!shown && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-6 p-8">
          <h2 className="text-3xl font-semibold text-white/90 text-balance">{title}</h2>
          <p className="shrink-0 text-5xl font-semibold tabular-nums text-white">
            {count}
            <span className="text-2xl text-white/50"> / {target}</span>
          </p>
        </div>
      )}

      {/* The host's controls, quiet so they do not draw the room's eye. */}
      <div className="absolute bottom-4 right-4 flex gap-2 opacity-30 transition-opacity hover:opacity-100 focus-within:opacity-100">
        {shown ? (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-sm text-white"
          >
            <Undo2 className="size-4" aria-hidden />
            {t('lightReset')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={simulate}
              disabled={simulated !== null}
              className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              <Zap className="size-4" aria-hidden />
              {t('lightSimulate')}
            </button>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-sm text-white"
            >
              <Sparkles className="size-4" aria-hidden />
              {t('lightReveal')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
