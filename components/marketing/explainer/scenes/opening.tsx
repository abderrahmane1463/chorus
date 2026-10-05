'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { glide, settle, useCount, useEnter, useKeys } from '../motion';
import { Display, Line, Mark, Scene } from '../parts';
import type { Layout } from '../timeline';

type SceneProps = { time: MotionValue<number>; layout: Layout };

/** The brand name set letter by letter, each rising from its own baseline. */
export function Letters({
  time,
  at,
  text,
  size,
  className,
}: {
  time: MotionValue<number>;
  at: number;
  text: string;
  size: number;
  className?: string;
}) {
  return (
    // The name is Latin in every language, so it keeps its own direction.
    <span
      dir="ltr"
      className={className}
      style={{ fontSize: size, letterSpacing: '0.32em', marginInlineEnd: '-0.32em' }}
      aria-hidden
    >
      {[...text].map((letter, index) => (
        <span key={index} className="inline-block">
          <Line time={time} at={at + index * 0.06}>
            {letter}
          </Line>
        </span>
      ))}
    </span>
  );
}

/** 01 — The mark rises like a room starting to answer, then the name and the promise. */
export function IntroScene({ time, layout }: SceneProps) {
  const t = useTranslations('explainer');
  const wide = layout === 'wide';

  // A slow push toward the viewer as the scene hands over.
  const scale = useKeys(time, [0, 3.4, 4.6], [0.98, 1, 1.05], glide);
  const glow = useKeys(time, [0.2, 1.8], [0, 1]);
  const glowScale = useKeys(time, [0.2, 2.4], [0.6, 1]);

  return (
    <Scene time={time} name="intro">
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{ scale }}
      >
        <motion.div
          className="absolute rounded-full"
          style={{
            width: wide ? 620 : 560,
            height: wide ? 620 : 560,
            opacity: glow,
            scale: glowScale,
            background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 26%, transparent), transparent)',
            top: wide ? 90 : 220,
          }}
        />
        <Mark time={time} at={0.35} size={wide ? 150 : 170} className="relative" />
        <Letters
          time={time}
          at={1.15}
          text="CHORUS"
          size={wide ? 104 : 92}
          className="relative mt-10 font-semibold text-foreground"
        />
        <div
          className="relative mt-6 text-muted-foreground"
          style={{ fontSize: wide ? 34 : 38, maxWidth: wide ? 900 : 720 }}
        >
          <Line time={time} at={2.3}>
            {t('tagline')}
          </Line>
        </div>
      </motion.div>
    </Scene>
  );
}

/** Seats per row, front to back, and the order phones light up in. */
const ROWS = [17, 15, 13, 11, 9];

/** A fixed shuffle, so the same phones light in the same order every loop. */
function lightOrder(index: number) {
  return ((index * 37) % 61) / 61;
}

/**
 * 02 — A room: the big screen showing the join code, and the audience's
 * phones lighting up one by one as people join. The camera then moves into
 * the screen, where the platform is.
 */
export function EventScene({ time, layout }: SceneProps) {
  const t = useTranslations('explainer');
  const tp = useTranslations('presenter');
  const wide = layout === 'wide';

  // The room, positioned around its big screen.
  const screen = wide
    ? { width: 660, height: 372, left: 760, top: 96 }
    : { width: 780, height: 440, left: 60, top: 300 };
  const screenCenter = {
    x: screen.left + screen.width / 2,
    y: screen.top + screen.height / 2,
  };

  // Drifting slightly, then dollying into the screen to hand over.
  const roomScale = useKeys(time, [4.3, 9.0, 10.7], [1, 1.04, 2.7], [glide, glide]);
  const roomOpacity = useKeys(time, [9.9, 10.6], [1, 0]);
  const players = useCount(time, 0, 48, 5.6, 8.4);
  const captions = useEnter(time, 5.0, { until: 9.4, rise: 0 });

  return (
    <Scene time={time} name="event">
      <motion.div
        className="absolute inset-0"
        style={{
          scale: roomScale,
          opacity: roomOpacity,
          transformOrigin: `${screenCenter.x}px ${screenCenter.y}px`,
        }}
      >
        {/* The screen's light falling on the room. */}
        <div
          className="absolute rounded-full"
          style={{
            left: screenCenter.x - 520,
            top: screenCenter.y - 300,
            width: 1040,
            height: 760,
            background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 14%, transparent), transparent)',
          }}
        />

        <div className="absolute" style={{ left: screen.left, top: screen.top }}>
          <Display width={screen.width} height={screen.height}>
            <div className="flex h-full items-center gap-8 p-8">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value="https://chorus.sense-event-manager.com/join" size={wide ? 150 : 180} level="M" />
              </div>
              <div className="min-w-0">
                <p className="text-[20px] text-muted-foreground">{tp('joinAt')}</p>
                <p
                  dir="ltr"
                  className="mt-1 font-mono font-semibold tracking-[0.18em] text-foreground"
                  style={{ fontSize: wide ? 46 : 54 }}
                >
                  BRAVO-42
                </p>
                <p className="mt-5 text-[24px] font-semibold">{t('eventTitle')}</p>
                <p className="mt-1 text-[20px] tabular-nums text-primary">
                  <motion.span>{players}</motion.span>
                  <span className="text-muted-foreground"> · {t('nodeParticipants')}</span>
                </p>
              </div>
            </div>
          </Display>
        </div>

        <Audience time={time} wide={wide} />
      </motion.div>

      <motion.div
        className="absolute font-semibold leading-[1.08]"
        style={
          wide
            ? { left: 110, top: 300, width: 560, fontSize: 64, opacity: captions.opacity }
            : { left: 0, right: 0, top: 70, textAlign: 'center', fontSize: 60, opacity: captions.opacity }
        }
      >
        <Line time={time} at={5.2}>
          {t('onePlatform')}
        </Line>
        <Line time={time} at={5.9} className="text-primary">
          {t('oneExperience')}
        </Line>
      </motion.div>
    </Scene>
  );
}

/** Rows of people, nearer rows larger, each holding a phone that lights when they join. */
function Audience({ time, wide }: { time: MotionValue<number>; wide: boolean }) {
  const area = wide
    ? { centerX: 1090, top: 540, rowGap: 64, spread: 52 }
    : { centerX: 450, top: 820, rowGap: 64, spread: 50 };

  let seat = 0;

  return (
    <>
      {ROWS.slice()
        .reverse()
        .map((count, backIndex) => {
          // Rows are drawn back to front, so nearer heads overlap further ones.
          const depth = ROWS.length - 1 - backIndex;
          const nearness = 1 - depth / ROWS.length;
          const size = 18 + nearness * 20;
          const gap = area.spread * (0.75 + nearness * 0.55);
          const y = area.top + (ROWS.length - 1 - depth) * area.rowGap * (0.7 + nearness * 0.4);

          return Array.from({ length: count }, (_, index) => {
            const x = area.centerX + (index - (count - 1) / 2) * gap;
            const lightAt = 5.5 + lightOrder(seat++) * 2.8;
            return (
              <Person key={`${depth}-${index}`} time={time} x={x} y={y} size={size} lightAt={lightAt} />
            );
          });
        })}
    </>
  );
}

function Person({
  time,
  x,
  y,
  size,
  lightAt,
}: {
  time: MotionValue<number>;
  x: number;
  y: number;
  size: number;
  lightAt: number;
}) {
  const lit = useKeys(time, [lightAt, lightAt + 0.35], [0, 1], settle);
  const glowScale = useTransform(lit, [0, 1], [0.4, 1]);
  const glowOpacity = useTransform(lit, [0, 1], [0, 0.35]);

  return (
    <div className="absolute" style={{ left: x - size / 2, top: y }}>
      {/* Head and shoulders, in the room's dark. */}
      <div className="rounded-full bg-[#1a2b31]" style={{ width: size, height: size }} />
      <div
        className="rounded-t-full bg-[#14232a]"
        style={{ width: size * 1.7, height: size * 0.9, marginInlineStart: -size * 0.35, marginTop: 3 }}
      />
      {/* The phone, lighting the face above it once its owner has joined. */}
      <motion.div
        className="absolute rounded-[3px] bg-primary"
        style={{
          width: size * 0.42,
          height: size * 0.66,
          left: size * 0.29,
          top: size * 1.05,
          opacity: lit,
          boxShadow: '0 0 18px 4px color-mix(in srgb, var(--primary) 55%, transparent)',
        }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.6,
          height: size * 1.6,
          left: -size * 0.3,
          top: -size * 0.2,
          opacity: glowOpacity,
          scale: glowScale,
          background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 50%, transparent), transparent)',
        }}
      />
    </div>
  );
}
