'use client';

import type { ReactNode } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { isLocale, localeDirection } from '@/i18n/config';
import { BarChart3, CalendarDays, Download, LayoutDashboard, MonitorPlay, Plus, Settings } from 'lucide-react';
import { TileLetter, tileFor } from '@/components/quiz/answer-tiles';
import { cn } from '@/lib/utils/cn';
import { glide, linear, settle, spring, useEnter, useKeys } from '../motion';
import { LiveBadge, Line, Mark, Scene } from '../parts';
import type { Layout } from '../timeline';

type SceneProps = { time: MotionValue<number>; layout: Layout };

/** Each verb has the stage for this long, in order. */
const VERBS = ['create', 'manage', 'engage', 'visualize'] as const;
const VERB_AT = [37.2, 38.8, 40.4, 42.0];
const VERB_FOR = 1.6;

const TYPES = ['multiple_choice', 'word_cloud', 'rating', 'q_and_a', 'ranking', 'quiz', 'survey', 'open_text'] as const;

function geometry(layout: Layout) {
  return layout === 'wide'
    ? { left: 120, top: 186, width: 1360, height: 664, sidebar: true }
    : { left: 40, top: 250, width: 820, height: 900, sidebar: false };
}

/**
 * 06 — The organizer's side, as the dashboard draws it: interactions added
 * from the picker, the quiz lobby filling before Start, the event's live
 * numbers, and the results in analytics. Four verbs, each lighting the part
 * of the dashboard that does it.
 */
export function OrganizerScene({ time, layout }: SceneProps) {
  const t = useTranslations('explainer');
  const wide = layout === 'wide';
  const g = geometry(layout);
  const locale = useLocale();
  // The verbs are read in order, so they run in the reader's direction.
  const verbsDir = isLocale(locale) ? localeDirection[locale] : 'ltr';

  const enter = useKeys(time, [36.5, 37.3], [0, 1], settle);
  const rise = useKeys(time, [36.5, 37.3], [50, 0], settle);
  const tilt = useKeys(time, [36.5, 37.3, 43.8], [8, 2, 0], glide);

  return (
    <Scene time={time} name="organizer">
      <div
        dir={verbsDir}
        className="absolute inset-x-0 flex justify-center gap-[0.9em] font-semibold"
        style={{ top: wide ? 44 : 60, fontSize: wide ? 46 : 40 }}
      >
        {VERBS.map((verb, index) => (
          <Verb key={verb} time={time} index={index} label={t(verb)} />
        ))}
      </div>
      <div
        className="absolute inset-x-0 text-center text-muted-foreground"
        style={{ top: wide ? 116 : 150, fontSize: wide ? 24 : 28, paddingInline: 40 }}
      >
        <Line time={time} at={37.0}>
          {t('organizerCaption')}
        </Line>
      </div>

      <motion.div
        className="absolute flex overflow-hidden rounded-2xl border border-[#24393f] bg-background shadow-[0_50px_100px_-30px_rgba(0,0,0,0.7)]"
        style={{
          left: g.left,
          top: g.top,
          width: g.width,
          height: g.height,
          opacity: enter,
          y: rise,
          rotateX: tilt,
          transformPerspective: 1800,
        }}
      >
        {g.sidebar && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col p-7">
          <Header time={time} />
          <div className="mt-6 grid flex-1 grid-cols-2 grid-rows-2 gap-5">
            <Panel time={time} index={0}>
              <CreatePanel time={time} />
            </Panel>
            <Panel time={time} index={1}>
              <ManagePanel time={time} wide={wide} />
            </Panel>
            <Panel time={time} index={2}>
              <EngagePanel time={time} />
            </Panel>
            <Panel time={time} index={3}>
              <VisualizePanel time={time} />
            </Panel>
          </div>
        </div>
      </motion.div>
    </Scene>
  );
}

/** How much a verb owns the stage right now: 0 before and after, 1 during. */
function useFocus(time: MotionValue<number>, index: number) {
  const at = VERB_AT[index];
  const last = index === VERBS.length - 1;
  return useKeys(
    time,
    last ? [at - 0.2, at + 0.2] : [at - 0.2, at + 0.2, at + VERB_FOR - 0.2, at + VERB_FOR + 0.2],
    last ? [0, 1] : [0, 1, 1, 0],
    linear,
  );
}

function Verb({ time, index, label }: { time: MotionValue<number>; index: number; label: string }) {
  const focus = useFocus(time, index);
  const enter = useEnter(time, 36.7 + index * 0.1, { rise: 20 });
  const opacity = useTransform([enter.opacity, focus], ([a, f]) => (a as number) * (0.3 + (f as number) * 0.7));
  const color = useTransform(focus, [0, 1], ['var(--foreground)', 'var(--primary)']);
  return (
    <motion.span style={{ opacity, y: enter.y, color }}>
      {label}
    </motion.span>
  );
}

/** A part of the dashboard that lights up while its verb has the stage. */
function Panel({ time, index, children }: { time: MotionValue<number>; index: number; children: ReactNode }) {
  const focus = useFocus(time, index);
  const before = useKeys(time, [VERB_AT[0] - 0.2, VERB_AT[0] + 0.2], [1, 0], linear);
  // Before the first verb every panel is fully there; after that, the one in
  // focus leads and the rest step back.
  const opacity = useTransform([focus, before], ([f, b]) => Math.max(0.42 + (f as number) * 0.58, b as number));
  const ring = useTransform(focus, (f) => `0 0 0 ${f * 2}px var(--primary), 0 24px 60px -30px rgba(0,0,0,${0.4 + f * 0.4})`);
  const scale = useTransform(focus, [0, 1], [1, 1.015]);

  return (
    <motion.div
      className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-5"
      style={{ opacity, boxShadow: ring, scale }}
    >
      {children}
    </motion.div>
  );
}

function Sidebar() {
  const t = useTranslations('dash');
  const items = [
    { icon: LayoutDashboard, label: t('overview') },
    { icon: CalendarDays, label: t('events'), active: true },
    { icon: BarChart3, label: t('analytics') },
    { icon: Settings, label: t('settings') },
  ];
  return (
    <div className="flex w-[220px] shrink-0 flex-col gap-1 border-e border-border bg-card/60 p-5">
      <div className="mb-6 flex items-center gap-2.5" dir="ltr">
        <Mark size={30} />
        <span className="text-[22px] font-semibold tracking-tight">Chorus</span>
      </div>
      {items.map(({ icon: Icon, label, active }) => (
        <span
          key={label}
          className={cn(
            'flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-[16px]',
            active ? 'bg-primary-subtle font-medium text-primary' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

function Header({ time }: { time: MotionValue<number> }) {
  const t = useTranslations('explainer');
  const tStatus = useTranslations('status');
  const tw = useTranslations('workspace');
  // Engage: the organizer puts the event on the big screen.
  const at = VERB_AT[2] + 0.3;
  const press = useKeys(time, [at, at + 0.1, at + 0.4], [1, 0.93, 1], [linear, spring]);

  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[28px] font-semibold">{t('eventTitle')}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <LiveBadge label={tStatus('live')} />
          <span dir="ltr" className="font-mono text-[17px] text-muted-foreground">
            BRAVO-42
          </span>
        </div>
      </div>
      <motion.span
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[18px] font-medium text-primary-foreground"
        style={{ scale: press }}
      >
        <MonitorPlay className="size-5" aria-hidden />
        {tw('present')}
      </motion.span>
    </div>
  );
}

function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="truncate text-[18px] font-semibold">{children}</p>
      {action}
    </div>
  );
}

/** Create: the picker opens, Quiz is chosen, and it joins the event's list. */
function CreatePanel({ time }: { time: MotionValue<number> }) {
  const tp = useTranslations('picker');
  const tt = useTranslations('types');
  const ta = useTranslations('analytics');
  const at = VERB_AT[0];
  const pickAt = at + 0.75;

  const pickerOpacity = useKeys(time, [at, at + 0.3, pickAt + 0.45, pickAt + 0.7], [0, 1, 1, 0], linear);
  const listOpacity = useKeys(time, [at, at + 0.25, pickAt + 0.6, pickAt + 0.9], [1, 0, 0, 1], linear);
  const added = useKeys(time, [pickAt + 0.7, pickAt + 1.1], [0, 1], settle);
  const addedY = useKeys(time, [pickAt + 0.7, pickAt + 1.1], [12, 0], settle);
  const buttonPress = useKeys(time, [at - 0.05, at + 0.05, at + 0.3], [1, 0.93, 1], [linear, spring]);

  return (
    <>
      <PanelTitle
        action={
          <motion.span
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[15px] font-medium"
            style={{ scale: buttonPress }}
          >
            <Plus className="size-4" aria-hidden />
            {tp('add')}
          </motion.span>
        }
      >
        {ta('interactions')}
      </PanelTitle>

      <div className="relative flex-1">
        <motion.div className="absolute inset-0 space-y-2" style={{ opacity: listOpacity }}>
          <ListRow index={1} label={tt('multiple_choice.name')} />
          <ListRow index={3} label={tt('q_and_a.name')} />
          <motion.div style={{ opacity: added, y: addedY }}>
            <ListRow index={0} label={tt('quiz.name')} highlight />
          </motion.div>
        </motion.div>

        <motion.div className="absolute inset-0 grid grid-cols-2 content-start gap-2" style={{ opacity: pickerOpacity }}>
          {TYPES.map((type) => (
            <PickerItem key={type} time={time} label={tt(`${type}.name`)} pickAt={type === 'quiz' ? pickAt : undefined} />
          ))}
        </motion.div>
      </div>
    </>
  );
}

function PickerItem({ time, label, pickAt }: { time: MotionValue<number>; label: string; pickAt?: number }) {
  const at = pickAt ?? Number.POSITIVE_INFINITY;
  const chosen = useKeys(time, [at, at + 0.15], [0, 1], linear);
  const scale = useKeys(time, [at, at + 0.1, at + 0.4], [1, 0.94, 1], [linear, spring]);
  return (
    <motion.span
      className="relative truncate rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
      style={{ scale: pickAt === undefined ? 1 : scale }}
    >
      {pickAt !== undefined && (
        <motion.span className="absolute inset-0 rounded-lg border-2 border-primary bg-primary-subtle" style={{ opacity: chosen }} />
      )}
      <span className="relative">{label}</span>
    </motion.span>
  );
}

function ListRow({ index, label, highlight = false }: { index: number; label: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 text-[16px]',
        highlight ? 'border-primary/60 bg-primary-subtle' : 'border-border bg-background',
      )}
    >
      <TileLetter index={index} className="size-7 text-sm" />
      <span className="truncate">{label}</span>
    </div>
  );
}

const PLAYERS = ['Sara', 'Amine', 'Yacine', 'Lina', 'Karim', 'Nadia', 'Rami', 'Meriem'];

/** Manage: the quiz lobby filling, then the organizer starts the quiz. */
function ManagePanel({ time, wide }: { time: MotionValue<number>; wide: boolean }) {
  const tq = useTranslations('quizEditor');
  const tp = useTranslations('presenter');
  const at = VERB_AT[1];
  const startAt = at + 1.2;
  const press = useKeys(time, [startAt, startAt + 0.1, startAt + 0.4], [1, 0.94, 1], [linear, spring]);
  const shown = wide ? PLAYERS.slice(0, 6) : PLAYERS;

  return (
    <>
      <PanelTitle>{tq('lobbyTitle')}</PanelTitle>
      <div className="flex flex-1 flex-wrap content-start gap-2">
        {shown.map((name, index) => (
          <PlayerChip key={name} time={time} at={at - 1.2 + index * 0.22} name={name} index={index} />
        ))}
      </div>
      <motion.span
        className="mt-3 inline-flex items-center justify-center self-start rounded-lg bg-primary px-5 py-2.5 text-[16px] font-medium text-primary-foreground"
        style={{ scale: press }}
      >
        {tp('startQuiz')}
      </motion.span>
    </>
  );
}

function PlayerChip({ time, at, name, index }: { time: MotionValue<number>; at: number; name: string; index: number }) {
  const scale = useKeys(time, [at, at + 0.4], [0.6, 1], spring);
  const opacity = useKeys(time, [at, at + 0.2], [0, 1], linear);
  return (
    <motion.span
      className="inline-flex items-center gap-2 rounded-full border border-border bg-background py-1 pe-3.5 ps-1 text-[15px]"
      style={{ scale, opacity }}
    >
      <span className={cn('flex size-7 items-center justify-center rounded-full text-[13px] font-semibold text-white', tileFor(index).surface)}>
        {name[0]}
      </span>
      {name}
    </motion.span>
  );
}

/** Engage: the event live, its numbers moving as the room takes part. */
function EngagePanel({ time }: { time: MotionValue<number> }) {
  const t = useTranslations('dash');
  const format = useFormatter();
  const at = VERB_AT[2];
  const participants = useKeys(time, [at - 1.5, at + 0.6], [31, 48], glide);
  const responses = useKeys(time, [at - 1.5, at + 1.5], [612, 1284], glide);
  const participantsText = useTransform(participants, (n) => format.number(Math.round(n)));
  const responsesText = useTransform(responses, (n) => format.number(Math.round(n)));

  return (
    <div className="grid flex-1 grid-cols-2 gap-4">
      <Stat label={t('participants')} value={participantsText} />
      <Stat label={t('responses')} value={responsesText} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: MotionValue<string> }) {
  return (
    <div className="flex flex-col justify-center rounded-lg border border-border bg-background p-4">
      <p className="text-[15px] text-muted-foreground">{label}</p>
      <motion.p className="mt-2 text-[40px] font-semibold leading-none tabular-nums">{value}</motion.p>
    </div>
  );
}

/** Visualize: the results charted, ready to export. */
function VisualizePanel({ time }: { time: MotionValue<number> }) {
  const t = useTranslations('dash');
  const te = useTranslations('eventAnalytics');
  const at = VERB_AT[3];
  const shares = [0.92, 0.6, 0.78, 0.4, 0.66, 0.5];
  const exportAt = at + 0.5;
  const exportIn = useKeys(time, [exportAt, exportAt + 0.3], [0, 1], linear);

  return (
    <>
      <PanelTitle
        action={
          <motion.span
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[14px] font-medium"
            style={{ opacity: exportIn }}
          >
            <Download className="size-4" aria-hidden />
            {te('responsesCsv')}
          </motion.span>
        }
      >
        {t('analytics')}
      </PanelTitle>
      <div className="flex flex-1 items-end gap-3 border-b border-border pb-1">
        {shares.map((share, index) => (
          <Column key={index} time={time} at={at - 0.1 + index * 0.08} share={share} index={index} />
        ))}
      </div>
    </>
  );
}

function Column({ time, at, share, index }: { time: MotionValue<number>; at: number; share: number; index: number }) {
  // A quiet version of the chart is there from the start; it fills in when Visualize has the stage.
  const scaleY = useKeys(time, [at, at + 0.7], [share * 0.25, share], settle);
  return (
    <motion.span
      className={cn('block h-full flex-1 origin-bottom rounded-t-md', tileFor(index % 4).chart)}
      style={{ scaleY }}
    />
  );
}
