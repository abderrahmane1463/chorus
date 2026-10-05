'use client';

import type { ReactNode } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { CalendarDays } from 'lucide-react';
import { tileFor } from '@/components/quiz/answer-tiles';
import { cn } from '@/lib/utils/cn';
import { glide, linear, settle, spring, useCount, useEnter, useKeys } from '../motion';
import { Chip, LiveBadge, Mark, Scene } from '../parts';
import type { Layout } from '../timeline';

type SceneProps = { time: MotionValue<number>; layout: Layout };

type Node = { x: number; y: number };

/** Where the four cards sit, and their size, for each composition. */
function geometry(layout: Layout) {
  if (layout === 'wide') {
    return {
      card: { width: 300, height: 220 },
      nodes: [230, 610, 990, 1370].map((x) => ({ x, y: 480 })) as Node[],
      horizontal: true,
    };
  }
  return {
    card: { width: 620, height: 190 },
    nodes: [270, 530, 790, 1050].map((y) => ({ x: 450, y })) as Node[],
    horizontal: false,
  };
}

/** When each card arrives and each line between them draws. */
const CARD_AT = [10.9, 12.1, 13.3, 15.1];
const LINE_AT = [11.5, 12.7, 14.5];
const LINE_FOR = 0.65;

/**
 * 03 — The whole idea in four cards: the event, Chorus, the people, the live
 * experience. Each card arrives as the line from the previous one reaches
 * it, and once all are connected, signals keep moving along the lines.
 */
export function FlowScene({ time, layout }: SceneProps) {
  const t = useTranslations('explainer');
  const tStatus = useTranslations('status');
  const { card, nodes, horizontal } = geometry(layout);
  const eyebrow = useEnter(time, 10.6, { until: 17.9, rise: 12 });

  // Handing over: the participants' card comes forward to become the phone
  // in the next scene; everything else steps back.
  const recede = useKeys(time, [17.5, 18.4], [1, 0], glide);

  return (
    <Scene time={time} name="flow">
      <motion.p
        className="absolute inset-x-0 text-center font-medium uppercase tracking-[0.3em] text-primary"
        style={{ top: horizontal ? 150 : 70, fontSize: horizontal ? 22 : 26, ...eyebrow }}
      >
        {t('howItWorks')}
      </motion.p>

      <motion.svg
        className="absolute inset-0"
        width="100%"
        height="100%"
        style={{ opacity: recede }}
        aria-hidden
      >
        {LINE_AT.map((at, index) => (
          <Connector
            key={index}
            time={time}
            at={at}
            from={edge(nodes[index], card, horizontal, 'end')}
            to={edge(nodes[index + 1], card, horizontal, 'start')}
          />
        ))}
      </motion.svg>

      <Card time={time} at={CARD_AT[0]} node={nodes[0]} card={card} label={t('nodeEvent')} fade={recede}>
        <div className="min-w-0">
          <p className="flex items-center gap-2.5 truncate text-[24px] font-semibold">
            <CalendarDays className="size-6 shrink-0 text-primary" aria-hidden />
            {t('eventTitle')}
          </p>
          <div className="mt-3 flex items-center gap-2">
              <LiveBadge label={tStatus('live')} />
              <Chip className="font-mono">
                <span dir="ltr">BRAVO-42</span>
              </Chip>
          </div>
        </div>
      </Card>

      <Card time={time} at={CARD_AT[1]} node={nodes[1]} card={card} label={t('nodeChorus')} fade={recede} highlight>
        <div className="flex items-center gap-4" dir="ltr">
          <Mark time={time} at={CARD_AT[1] + 0.2} size={72} />
          <span className="text-[40px] font-semibold tracking-tight">Chorus</span>
        </div>
        <Ripple time={time} at={CARD_AT[1] + 0.8} />
      </Card>

      <Card
        time={time}
        at={CARD_AT[2]}
        node={nodes[2]}
        card={card}
        label={t('nodeParticipants')}
        handover={{ time, horizontal, nodes }}
      >
        <Avatars time={time} at={CARD_AT[2] + 0.2} />
      </Card>

      <Card time={time} at={CARD_AT[3]} node={nodes[3]} card={card} label={t('nodeLive')} fade={recede}>
        <LiveChart time={time} at={CARD_AT[3] + 0.2} horizontal={horizontal} />
      </Card>
    </Scene>
  );
}

function edge(node: Node, card: { width: number; height: number }, horizontal: boolean, side: 'start' | 'end') {
  const sign = side === 'start' ? -1 : 1;
  return horizontal
    ? { x: node.x + (sign * card.width) / 2, y: node.y }
    : { x: node.x, y: node.y + (sign * card.height) / 2 };
}

/** A line that draws itself from one card to the next, then carries signals. */
function Connector({
  time,
  at,
  from,
  to,
}: {
  time: MotionValue<number>;
  at: number;
  from: Node;
  to: Node;
}) {
  const drawn = useKeys(time, [at, at + LINE_FOR], [0, 1], glide);
  const flowing = useKeys(time, [at + LINE_FOR, at + LINE_FOR + 0.3], [0, 1], linear);

  return (
    <g>
      <motion.line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="var(--primary)"
        strokeWidth={3}
        strokeLinecap="round"
        style={{ pathLength: drawn, opacity: 0.55 }}
      />
      {[0, 0.5].map((offset) => (
        <Signal key={offset} time={time} start={at + LINE_FOR} offset={offset} from={from} to={to} visible={flowing} />
      ))}
    </g>
  );
}

/** A point of light travelling along a line, again and again. */
function Signal({
  time,
  start,
  offset,
  from,
  to,
  visible,
}: {
  time: MotionValue<number>;
  start: number;
  offset: number;
  from: Node;
  to: Node;
  visible: MotionValue<number>;
}) {
  const progress = useTransform(time, (t) => (((t - start) * 0.75 + offset) % 1 + 1) % 1);
  const cx = useTransform(progress, (p) => from.x + (to.x - from.x) * p);
  const cy = useTransform(progress, (p) => from.y + (to.y - from.y) * p);
  // Fades at both ends, so a signal appears out of one card and into the next.
  const fade = useTransform(progress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
  const opacity = useTransform([fade, visible], ([a, b]) => (a as number) * (b as number));

  return (
    <motion.circle
      r={6}
      fill="var(--primary)"
      style={{ cx, cy, opacity, filter: 'drop-shadow(0 0 6px var(--primary))' }}
    />
  );
}

/** A card in the flow, arriving at its moment. */
function Card({
  time,
  at,
  node,
  card,
  label,
  fade,
  highlight = false,
  handover,
  children,
}: {
  time: MotionValue<number>;
  at: number;
  node: Node;
  card: { width: number; height: number };
  label: string;
  fade?: MotionValue<number>;
  highlight?: boolean;
  /** The card that grows into the next scene's phone. */
  handover?: { time: MotionValue<number>; horizontal: boolean; nodes: Node[] };
  children: ReactNode;
}) {
  const enter = useKeys(time, [at, at + 0.7], [0, 1], settle);
  const y = useKeys(time, [at, at + 0.7], [18, 0], settle);
  const scaleIn = useKeys(time, [at, at + 0.7], [0.94, 1], spring);

  // Toward the middle of the stage, where the phone will stand.
  const centerX = handover ? (handover.horizontal ? 800 : 450) : node.x;
  const centerY = handover ? (handover.horizontal ? 450 : 600) : node.y;
  const moveX = useKeys(time, [17.5, 18.5], [0, centerX - node.x], glide);
  const moveY = useKeys(time, [17.5, 18.5], [0, centerY - node.y], glide);
  const grow = useKeys(time, [17.5, 18.5], [1, 1.25], glide);
  const leave = useKeys(time, [18.0, 18.6], [1, 0], linear);

  const opacity = useTransform([enter, fade ?? enter, leave], ([a, b, c]) =>
    (a as number) * (fade ? (b as number) : 1) * (handover ? (c as number) : 1),
  );
  const scale = useTransform([scaleIn, grow], ([a, b]) => (a as number) * (handover ? (b as number) : 1));
  const shiftY = useTransform([y, moveY], ([a, b]) => (a as number) + (handover ? (b as number) : 0));

  return (
    <motion.div
      className={cn(
        'absolute flex flex-col rounded-3xl border bg-card p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]',
        highlight ? 'border-primary/50' : 'border-border',
      )}
      style={{
        left: node.x - card.width / 2,
        top: node.y - card.height / 2,
        width: card.width,
        height: card.height,
        opacity,
        y: shiftY,
        x: handover ? moveX : 0,
        scale,
      }}
    >
      <span className="mb-4 text-[17px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="relative flex flex-1 items-center">{children}</div>
    </motion.div>
  );
}

/** A ring leaving the Chorus card: the platform is live. */
function Ripple({ time, at }: { time: MotionValue<number>; at: number }) {
  const cycle = useTransform(time, (t) => (t < at ? 0 : ((t - at) % 1.8) / 1.8));
  const scale = useTransform(cycle, [0, 1], [1, 1.35]);
  const opacity = useTransform(cycle, [0, 0.1, 1], [0, 0.5, 0]);

  return (
    <motion.span
      className="pointer-events-none absolute -inset-6 rounded-3xl border-2 border-primary"
      style={{ scale, opacity }}
    />
  );
}

const INITIALS = ['S', 'A', 'Y', 'L', 'K', 'M'];

/** People arriving, one face at a time, and the count climbing. */
function Avatars({ time, at }: { time: MotionValue<number>; at: number }) {
  const t = useTranslations('explainer');
  const count = useCount(time, 0, 48, at, at + 1.6);

  return (
    <div>
      <div className="flex -space-x-2.5 rtl:space-x-reverse">
        {INITIALS.map((initial, index) => (
          <Avatar key={initial} time={time} at={at + index * 0.13} initial={initial} index={index} />
        ))}
      </div>
      <p className="mt-3 text-[22px] font-semibold tabular-nums">
        <motion.span>{count}</motion.span>{' '}
        <span className="font-normal text-muted-foreground">{t('joinedLabel')}</span>
      </p>
    </div>
  );
}

function Avatar({ time, at, initial, index }: { time: MotionValue<number>; at: number; initial: string; index: number }) {
  const scale = useKeys(time, [at, at + 0.45], [0, 1], spring);
  return (
    <motion.span
      className={cn(
        'flex size-12 items-center justify-center rounded-full border-2 border-card text-[18px] font-semibold text-white',
        tileFor(index).surface,
      )}
      style={{ scale }}
    >
      {initial}
    </motion.span>
  );
}

/** The room's answers as bars, in the quiz tiles' colours. */
function LiveChart({ time, at, horizontal }: { time: MotionValue<number>; at: number; horizontal: boolean }) {
  const tStatus = useTranslations('status');
  const shares = [0.95, 0.55, 0.32, 0.2];
  return (
    <div className="flex w-full items-end gap-3" style={{ height: horizontal ? 96 : 92 }}>
      {shares.map((share, index) => (
        <ChartBar key={index} time={time} at={at + index * 0.12} share={share} index={index} />
      ))}
      <LiveBadge label={tStatus('live')} className="ms-auto self-start" />
    </div>
  );
}

function ChartBar({ time, at, share, index }: { time: MotionValue<number>; at: number; share: number; index: number }) {
  const scaleY = useKeys(time, [at, at + 0.8], [0.05, share], settle);
  return (
    <motion.span
      className={cn('block h-full w-9 origin-bottom rounded-t-md', tileFor(index).chart)}
      style={{ scaleY }}
    />
  );
}
