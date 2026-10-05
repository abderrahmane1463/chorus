'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowUp, Check, Trophy } from 'lucide-react';
import { TileLetter, tileFor } from '@/components/quiz/answer-tiles';
import { cn } from '@/lib/utils/cn';
import { glide, linear, settle, spring, useCount, useKeys } from '../motion';
import { Display, Line, Mark, Phone, Scene } from '../parts';
import type { Layout } from '../timeline';
import { phonePlacement } from './participant';
import { ANSWERS, PHONE_WIDTH, PhoneScreen, QuestionScreen, ResultScreen, SentScreen } from './phone-ui';

type SceneProps = { time: MotionValue<number>; layout: Layout };
type Point = { x: number; y: number };

/** The moments the scene turns on. */
const OPEN = 28.7;
const TAP = 29.5;
const ARRIVE = 30.6;
const ROOM_FROM = 30.8;
const ROOM_TO = 32.6;
const REVEAL = 33.1;
const BOARD = 34.4;
const CLIMB = 35.1;

/** Where everything stands, for each composition. */
function geometry(layout: Layout) {
  if (layout === 'wide') {
    return {
      phone: { left: 300 - PHONE_WIDTH / 2, top: 112, scale: 0.82 },
      screen: { left: 660, top: 200, width: 880, height: 496 },
      hub: { x: 520, y: 172 },
      from: { x: 300, y: 250 },
      to: { x: 760, y: 200 },
      room: Array.from({ length: 18 }, (_, i) => ({ x: 700 + i * 46, y: 800 })),
    };
  }
  return {
    phone: { left: 450 - PHONE_WIDTH / 2, top: 770, scale: 0.6 },
    screen: { left: 40, top: 180, width: 820, height: 462 },
    hub: { x: 450, y: 706 },
    from: { x: 450, y: 772 },
    to: { x: 450, y: 642 },
    room: [
      ...Array.from({ length: 4 }, (_, i) => ({ x: 70 + i * 50, y: 1120 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: 680 + i * 50, y: 1120 })),
    ],
  };
}

/**
 * 05 — The phone and the room's big screen, side by side. A tap leaves the
 * phone, passes through Chorus and lands on the screen; the rest of the
 * room's answers follow; the answer is revealed and the scoreboard moves.
 * The point: what you do on your phone becomes part of the event.
 */
export function LiveScene({ time, layout }: SceneProps) {
  const t = useTranslations('explainer');
  const wide = layout === 'wide';
  const g = geometry(layout);
  const start = phonePlacement(layout);

  // The phone steps aside, from where the last scene left it.
  const left = useKeys(time, [28.4, 29.2], [start.left, g.phone.left], glide);
  const top = useKeys(time, [28.4, 29.2], [start.top, g.phone.top], glide);
  const scale = useKeys(time, [28.4, 29.2], [start.scale, g.phone.scale], glide);
  const screenIn = useKeys(time, [28.6, 29.4], [0, 1], settle);
  const screenScale = useKeys(time, [28.6, 29.4], [0.94, 1], settle);

  return (
    <Scene time={time} name="live">
      <div
        className="absolute font-semibold leading-[1.1]"
        style={
          wide
            ? { left: 110, top: 40, width: 1400, fontSize: 44 }
            : { left: 40, right: 40, top: 44, fontSize: 40, textAlign: 'center' }
        }
      >
        <Line time={time} at={29.0}>
          {t('liveCaption')} <span className="text-primary">{t('liveCaptionBody')}</span>
        </Line>
      </div>

      <motion.div
        className="absolute"
        style={{ left: g.screen.left, top: g.screen.top, opacity: screenIn, scale: screenScale }}
      >
        <Display width={g.screen.width} height={g.screen.height}>
          <BigScreen time={time} wide={wide} />
        </Display>
      </motion.div>

      <Flow time={time} g={g} />

      <motion.div
        className="absolute"
        style={{ left, top, scale, transformOrigin: wide ? '50% 50%' : '50% 0%' }}
      >
        <Phone width={PHONE_WIDTH}>
          <PhoneScreen time={time} from={28.4} to={TAP + 0.45}>
            <QuestionScreen time={time} openAt={OPEN} tapAt={TAP} number={3} />
          </PhoneScreen>
          <PhoneScreen time={time} from={TAP + 0.45} to={REVEAL + 0.2}>
            <SentScreen />
          </PhoneScreen>
          <PhoneScreen time={time} from={REVEAL + 0.2}>
            <ResultScreen time={time} at={REVEAL + 0.3} points={910} total={2550} rank={2} />
          </PhoneScreen>
        </Phone>
      </motion.div>
    </Scene>
  );
}

/** The point of light from the phone, through Chorus, to the screen; then the room's. */
function Flow({ time, g }: { time: MotionValue<number>; g: ReturnType<typeof geometry> }) {
  const pathIn = useKeys(time, [TAP, TAP + 0.3, ARRIVE + 0.4, ARRIVE + 0.9], [0, 0.6, 0.6, 0.15], linear);
  const hubIn = useKeys(time, [29.0, 29.5], [0, 1], settle);
  const hubPulse = useKeys(time, [30.05, 30.2, 30.6], [1, 1.25, 1], [linear, spring]);

  const d = `M ${g.from.x} ${g.from.y} Q ${(g.from.x + g.hub.x) / 2} ${g.hub.y - 10} ${g.hub.x} ${g.hub.y} Q ${(g.hub.x + g.to.x) / 2} ${g.hub.y - 10} ${g.to.x} ${g.to.y}`;

  return (
    <>
      <svg className="absolute inset-0" width="100%" height="100%" aria-hidden>
        <motion.path d={d} fill="none" stroke="var(--primary)" strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round" style={{ opacity: pathIn }} />
        <Traveller time={time} from={g.from} hub={g.hub} to={g.to} start={TAP + 0.1} end={ARRIVE} size={9} />
        {g.room.map((seat, index) => (
          <RoomAnswer key={index} time={time} seat={seat} to={g.to} start={roomStart(index, g.room.length)} />
        ))}
      </svg>

      {/* Chorus, in the middle of every exchange. */}
      <motion.div
        className="absolute flex size-[84px] items-center justify-center rounded-full border border-primary/50 bg-card shadow-[0_0_40px_-6px_var(--primary)]"
        style={{ left: g.hub.x - 42, top: g.hub.y - 42, opacity: hubIn, scale: hubPulse }}
      >
        <Mark size={46} />
      </motion.div>

      {g.room.map((seat, index) => (
        <Seat key={index} time={time} seat={seat} at={roomStart(index, g.room.length)} />
      ))}
    </>
  );
}

/** When each seat in the room sends its answer: spread over the room's window, in a fixed shuffle. */
function roomStart(index: number, count: number) {
  const order = ((index * 7) % count) / count;
  return ROOM_FROM + order * (ROOM_TO - ROOM_FROM - 0.6);
}

/** A phone in the room, lighting as its answer leaves. */
function Seat({ time, seat, at }: { time: MotionValue<number>; seat: Point; at: number }) {
  const lit = useKeys(time, [at, at + 0.25], [0, 1], settle);
  const glow = useTransform(lit, (l) => `0 0 ${l * 16}px ${l * 3}px color-mix(in srgb, var(--primary) ${Math.round(l * 50)}%, transparent)`);
  return (
    <span className="absolute h-7 w-4 rounded-[4px] border border-primary/40 bg-primary-subtle" style={{ left: seat.x - 8, top: seat.y - 14 }}>
      <motion.span className="absolute inset-0 rounded-[3px] bg-primary" style={{ opacity: lit, boxShadow: glow }} />
    </span>
  );
}

/** A point on two joined curves: the phone to Chorus, Chorus to the screen. */
function along(from: Point, hub: Point, to: Point, p: number): Point {
  const curve = (a: Point, b: Point, q: number) => {
    const control = { x: (a.x + b.x) / 2, y: hub.y - 10 };
    const u = 1 - q;
    return {
      x: u * u * a.x + 2 * u * q * control.x + q * q * b.x,
      y: u * u * a.y + 2 * u * q * control.y + q * q * b.y,
    };
  };
  return p < 0.5 ? curve(from, hub, p * 2) : curve(hub, to, (p - 0.5) * 2);
}

function Traveller({
  time,
  from,
  hub,
  to,
  start,
  end,
  size,
}: {
  time: MotionValue<number>;
  from: Point;
  hub: Point;
  to: Point;
  start: number;
  end: number;
  size: number;
}) {
  const progress = useKeys(time, [start, end], [0, 1], glide);
  const cx = useTransform(progress, (p) => along(from, hub, to, p).x);
  const cy = useTransform(progress, (p) => along(from, hub, to, p).y);
  const opacity = useKeys(time, [start, start + 0.1, end - 0.05, end + 0.1], [0, 1, 1, 0], linear);

  return (
    <motion.circle r={size} fill="var(--primary)" style={{ cx, cy, opacity, filter: 'drop-shadow(0 0 10px var(--primary))' }} />
  );
}

/** One of the room's answers rising from a seat straight to the screen. */
function RoomAnswer({ time, seat, to, start }: { time: MotionValue<number>; seat: Point; to: Point; start: number }) {
  const progress = useKeys(time, [start, start + 0.6], [0, 1], glide);
  const target = { x: to.x + (seat.x - to.x) * 0.55, y: to.y + 300 > seat.y ? seat.y - 120 : to.y };
  const cx = useTransform(progress, (p) => seat.x + (target.x - seat.x) * p);
  const cy = useTransform(progress, (p) => seat.y - 18 + (target.y - seat.y + 18) * p);
  const opacity = useKeys(time, [start, start + 0.08, start + 0.5, start + 0.6], [0, 1, 1, 0], linear);

  return <motion.circle r={5} fill="var(--primary)" style={{ cx, cy, opacity }} />;
}

/** The presenter's view of the question, as the room's projector shows it. */
function BigScreen({ time, wide }: { time: MotionValue<number>; wide: boolean }) {
  const t = useTranslations('explainer');
  const tp = useTranslations('presenter');
  const format = useFormatter();

  const answered = useTransform(time, (now) => {
    if (now < ARRIVE) return 31;
    if (now < ROOM_FROM) return 32;
    const share = Math.min(1, (now - ROOM_FROM) / (ROOM_TO - ROOM_FROM));
    return Math.round(32 + share * 16);
  });
  const answeredText = useTransform(answered, (count) =>
    count >= 48 ? tp('everyoneAnswered') : tp('answered', { count, total: 48 }),
  );
  const fill = useTransform(answered, (count) => count / 48);
  const flash = useKeys(time, [ARRIVE, ARRIVE + 0.1, ARRIVE + 0.6], [0, 1, 0], linear);

  const questionView = useKeys(time, [BOARD, BOARD + 0.4], [1, 0], linear);
  const boardView = useKeys(time, [BOARD + 0.2, BOARD + 0.6], [0, 1], linear);
  const revealed = useKeys(time, [REVEAL, REVEAL + 0.4], [0, 1], settle);
  const progressView = useTransform(revealed, (r) => 1 - r);

  const remaining = useTransform(time, (now) =>
    format.number(Math.max(0, Math.ceil(20 - Math.max(0, now - OPEN) * 4.2))),
  );
  const ring = useKeys(time, [OPEN, REVEAL - 0.2], [0, 1], linear);

  return (
    <div className="relative h-full">
      <motion.div className="absolute inset-0 p-9" style={{ opacity: questionView }}>
        <div className="flex items-center justify-between">
          <span className="text-[22px] text-muted-foreground">{tp('questionOf', { current: 3, total: 5 })}</span>
          <span className="relative flex size-[64px] items-center justify-center">
            <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--muted)" strokeWidth="5" />
              <motion.circle cx="32" cy="32" r="28" fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" style={{ pathLength: useTransform(ring, (r) => 1 - r) }} />
            </svg>
            <motion.span className="relative text-[24px] font-semibold tabular-nums">{remaining}</motion.span>
          </span>
        </div>
        <p className="mt-4 font-semibold leading-tight" style={{ fontSize: wide ? 34 : 34 }}>
          {t('question')}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {ANSWERS.map((key, index) => (
            <ScreenTile key={key} index={index} label={t(key)} revealed={revealed} correct={index === 0} />
          ))}
        </div>
        <motion.div className="mt-6" style={{ opacity: progressView }}>
          <div className="mb-2 flex items-center justify-between text-[19px] text-muted-foreground">
            <motion.span>{answeredText}</motion.span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full origin-left rounded-full bg-primary rtl:origin-right" style={{ scaleX: fill }} />
            <motion.div className="absolute inset-0 bg-primary/40" style={{ opacity: flash }} />
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="absolute inset-0 p-9" style={{ opacity: boardView }}>
        <p className="text-[30px] font-semibold">{tp('scoreboard')}</p>
        <Scoreboard time={time} />
      </motion.div>
    </div>
  );
}

function ScreenTile({
  index,
  label,
  revealed,
  correct,
}: {
  index: number;
  label: string;
  revealed: MotionValue<number>;
  correct: boolean;
}) {
  const opacity = useTransform(revealed, (r) => (correct ? 1 : 1 - r * 0.65));
  const check = useTransform(revealed, (r) => (correct ? r : 0));
  return (
    <motion.div
      className={cn('flex h-[74px] items-center gap-4 rounded-xl px-4 text-[22px] font-medium text-white', tileFor(index).surface)}
      style={{ opacity }}
    >
      <TileLetter index={index} />
      <span className="flex-1">{label}</span>
      <motion.span style={{ opacity: check }}>
        <Check className="size-7" aria-hidden />
      </motion.span>
    </motion.div>
  );
}

const STANDINGS = [
  { name: 'Yacine', points: 2720 },
  { name: 'Amine', points: 2480 },
  { name: 'Sara', points: 2550, climbs: true },
  { name: 'Lina', points: 2210 },
  { name: 'Karim', points: 1980 },
];

/** The scoreboard after the reveal: Sara climbs a place. */
function Scoreboard({ time }: { time: MotionValue<number> }) {
  return (
    <div className="relative mt-6" style={{ height: 5 * 66 }}>
      {STANDINGS.map((row, index) => (
        <ScoreRow key={row.name} time={time} row={row} index={index} />
      ))}
    </div>
  );
}

function ScoreRow({ time, row, index }: { time: MotionValue<number>; row: (typeof STANDINGS)[number]; index: number }) {
  const format = useFormatter();
  // Sara and Amine change places; everyone else stays.
  const target = row.name === 'Sara' ? 1 : row.name === 'Amine' ? 2 : index;
  const y = useKeys(time, [CLIMB, CLIMB + 0.6], [index * 66, target * 66], glide);
  const rank = useTransform(time, (now) => format.number((now >= CLIMB + 0.3 ? target : index) + 1));
  const arrow = useKeys(time, [CLIMB + 0.4, CLIMB + 0.7], [0, 1], linear);
  // Sara's total takes in the points from this question as she climbs.
  const points = useCount(time, row.climbs ? 1640 : row.points, row.points, BOARD + 0.4, CLIMB + 0.2, (n) => format.number(n));

  return (
    <motion.div
      className={cn(
        'absolute inset-x-0 flex h-[56px] items-center gap-4 rounded-xl border px-5 text-[22px]',
        row.climbs ? 'border-primary bg-primary-subtle' : 'border-border bg-card',
      )}
      style={{ y }}
    >
      <span className="flex w-8 justify-center font-semibold tabular-nums">
        {index === 0 ? <Trophy className="size-6 text-amber-500" aria-hidden /> : <motion.span>{rank}</motion.span>}
      </span>
      <span className="flex-1 font-medium">{row.name}</span>
      {row.climbs && (
        <motion.span className="inline-flex items-center gap-1 text-[18px] font-medium text-success" style={{ opacity: arrow }}>
          <ArrowUp className="size-5" aria-hidden />1
        </motion.span>
      )}
      <motion.span className="w-24 text-end font-semibold tabular-nums">{points}</motion.span>
    </motion.div>
  );
}
