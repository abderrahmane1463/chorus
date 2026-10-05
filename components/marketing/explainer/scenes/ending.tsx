'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { BarChart3, CalendarDays, LayoutList, MessagesSquare, MonitorPlay, Users } from 'lucide-react';
import { glide, linear, settle, useEnter, useKeys } from '../motion';
import { Line, Mark, Scene } from '../parts';
import type { Layout } from '../timeline';
import { Letters } from './opening';

type SceneProps = { time: MotionValue<number>; layout: Layout };

const PIECES = [
  { key: 'pieceEvent', icon: CalendarDays },
  { key: 'pieceParticipants', icon: Users },
  { key: 'pieceContent', icon: LayoutList },
  { key: 'pieceInteraction', icon: MessagesSquare },
  { key: 'pieceDisplay', icon: MonitorPlay },
  { key: 'pieceData', icon: BarChart3 },
] as const;

const GATHER = 46.0;

/**
 * 07 — Everything the film has shown, as six pieces around Chorus, joined to
 * it, then drawn into it: one mark, one event.
 */
export function BigPictureScene({ time, layout }: SceneProps) {
  const t = useTranslations('explainer');
  const wide = layout === 'wide';
  const center = wide ? { x: 800, y: 380 } : { x: 450, y: 500 };
  const radius = wide ? { x: 470, y: 230 } : { x: 300, y: 330 };

  const markScale = useKeys(time, [43.8, 44.4, GATHER, GATHER + 0.7], [0.6, 1, 1, 1.35], [settle, linear, glide]);
  const markIn = useKeys(time, [43.8, 44.3], [0, 1], linear);
  const halo = useKeys(time, [GATHER + 0.3, GATHER + 0.7, GATHER + 1.6], [0, 0.9, 0.35], linear);
  const haloScale = useKeys(time, [GATHER + 0.3, GATHER + 1.6], [0.5, 1.4], settle);

  return (
    <Scene time={time} name="bigPicture">
      <svg className="absolute inset-0" width="100%" height="100%" aria-hidden>
        {PIECES.map((piece, index) => (
          <Spoke key={piece.key} time={time} index={index} center={center} radius={radius} />
        ))}
      </svg>

      {PIECES.map((piece, index) => (
        <Piece
          key={piece.key}
          time={time}
          index={index}
          center={center}
          radius={radius}
          label={t(piece.key)}
          Icon={piece.icon}
        />
      ))}

      <motion.div
        className="absolute rounded-full"
        style={{
          left: center.x - 260,
          top: center.y - 260,
          width: 520,
          height: 520,
          opacity: halo,
          scale: haloScale,
          background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 30%, transparent), transparent)',
        }}
      />
      <motion.div
        className="absolute flex size-[150px] items-center justify-center rounded-[2rem] border border-primary/50 bg-card shadow-[0_0_60px_-10px_var(--primary)]"
        style={{ left: center.x - 75, top: center.y - 75, scale: markScale, opacity: markIn }}
      >
        <Mark size={92} />
      </motion.div>

      <div
        className="absolute inset-x-0 text-center font-semibold leading-[1.1]"
        style={{ top: wide ? 610 : 820, fontSize: wide ? 60 : 62 }}
      >
        <Line time={time} at={GATHER + 0.6}>
          {t('oneEvent')}
        </Line>
        <Line time={time} at={GATHER + 1.1} className="text-primary">
          {t('oneExperience')}
        </Line>
      </div>
    </Scene>
  );
}

/** Where a piece sits on the ellipse around Chorus, starting at the top. */
function seat(index: number, center: { x: number; y: number }, radius: { x: number; y: number }) {
  const angle = -Math.PI / 2 + (index / PIECES.length) * Math.PI * 2;
  return { x: center.x + Math.cos(angle) * radius.x, y: center.y + Math.sin(angle) * radius.y };
}

function useGather(time: MotionValue<number>, index: number) {
  const start = GATHER + index * 0.04;
  return useKeys(time, [start, start + 0.6], [0, 1], glide);
}

function Piece({
  time,
  index,
  center,
  radius,
  label,
  Icon,
}: {
  time: MotionValue<number>;
  index: number;
  center: { x: number; y: number };
  radius: { x: number; y: number };
  label: string;
  Icon: (typeof PIECES)[number]['icon'];
}) {
  const home = seat(index, center, radius);
  const enter = useEnter(time, 43.9 + index * 0.14, { rise: 18 });
  const gather = useGather(time, index);
  const x = useTransform(gather, (g) => (center.x - home.x) * g);
  const y = useTransform([gather, enter.y], ([g, rise]) => (center.y - home.y) * (g as number) + (rise as number));
  const scale = useTransform(gather, [0, 1], [1, 0.3]);
  const opacity = useTransform([enter.opacity, gather], ([o, g]) => (o as number) * (1 - (g as number)));

  return (
    <motion.div
      className="absolute flex h-[64px] w-[250px] items-center gap-3.5 rounded-2xl border border-border bg-card px-4 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.8)]"
      style={{ left: home.x - 125, top: home.y - 32, x, y, scale, opacity }}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="truncate text-[21px] font-medium">{label}</span>
    </motion.div>
  );
}

function Spoke({
  time,
  index,
  center,
  radius,
}: {
  time: MotionValue<number>;
  index: number;
  center: { x: number; y: number };
  radius: { x: number; y: number };
}) {
  const home = seat(index, center, radius);
  const at = 44.6 + index * 0.12;
  const drawn = useKeys(time, [at, at + 0.6], [0, 1], glide);
  const gather = useGather(time, index);
  const opacity = useTransform(gather, [0, 0.6], [0.5, 0]);
  // The signal running inward along each spoke, once it is drawn.
  const pulse = useTransform(time, (now) => (now < at + 0.6 ? 0 : (((now - at) * 0.8) % 1)));
  const cx = useTransform(pulse, (p) => home.x + (center.x - home.x) * p);
  const cy = useTransform(pulse, (p) => home.y + (center.y - home.y) * p);
  const dot = useTransform([pulse, gather], ([p, g]) => (p as number) > 0 ? (1 - (g as number)) * Math.sin(Math.PI * (p as number)) : 0);

  return (
    <g>
      <motion.line
        x1={home.x}
        y1={home.y}
        x2={center.x}
        y2={center.y}
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        style={{ pathLength: drawn, opacity }}
      />
      <motion.circle r={5} fill="var(--primary)" style={{ cx, cy, opacity: dot }} />
    </g>
  );
}

/**
 * 08 — The name, and who stands behind it. Sense Conseil's logo is shown
 * from its own file when one is in `public/brand`; until then, its name.
 */
export function BrandScene({ time, layout, partnerLogo }: SceneProps & { partnerLogo: string | null }) {
  const t = useTranslations('explainer');
  const wide = layout === 'wide';
  const powered = useEnter(time, 50.3, { rise: 14 });
  const logo = useEnter(time, 50.7, { rise: 14 });
  const rule = useKeys(time, [50.1, 50.9], [0, 1], settle);
  const drift = useKeys(time, [48.5, 54], [1, 1.04], linear);

  return (
    <Scene time={time} name="brand">
      <motion.div className="absolute inset-0 flex flex-col items-center justify-center" style={{ scale: drift }}>
        <Mark time={time} at={48.7} size={wide ? 96 : 120} />
        <Letters
          time={time}
          at={49.2}
          text="CHORUS"
          size={wide ? 88 : 84}
          className="mt-8 font-semibold text-foreground"
        />
        <motion.span
          className="mt-12 h-px w-[220px] origin-center bg-border"
          style={{ scaleX: rule }}
        />
        <motion.p
          className="mt-10 uppercase tracking-[0.3em] text-muted-foreground"
          style={{ fontSize: wide ? 18 : 22, ...powered }}
        >
          {t('poweredBy')}
        </motion.p>
        <motion.div className="mt-6 flex h-[84px] items-center" style={logo}>
          {partnerLogo ? (
            // A plain image: the logo is the partner's own file, shown as it is.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partnerLogo} alt="Sense Conseil" className="h-full w-auto object-contain" />
          ) : (
            <span dir="ltr" className="text-[44px] font-semibold tracking-tight text-foreground">
              Sense Conseil
            </span>
          )}
        </motion.div>
      </motion.div>
    </Scene>
  );
}
