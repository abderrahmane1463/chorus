'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowBigUp } from 'lucide-react';
import { linear, settle, spring, useCount, useEnter, useKeys } from '../motion';
import { Line, LiveBadge, Phone, Scene } from '../parts';
import type { Layout } from '../timeline';
import {
  JoinScreen,
  LobbyScreen,
  PHONE_WIDTH,
  PhoneScreen,
  QuestionScreen,
  ResultScreen,
  SentScreen,
} from './phone-ui';

type SceneProps = { time: MotionValue<number>; layout: Layout };

/** The phone's place on the stage, shared with the next scene so it does not jump. */
export function phonePlacement(layout: Layout) {
  return layout === 'wide'
    ? { left: 800 - PHONE_WIDTH / 2, top: 112, scale: 1 }
    : { left: 450 - PHONE_WIDTH / 2, top: 236, scale: 1.2 };
}

/** What the phone shows, and when. */
const JOIN = 18.9;
const LOBBY = 21.2;
const QUESTION = 22.7;
const TAP = 24.35;
const SENT = 24.8;
const RESULT = 26.0;

/**
 * 04 — One participant's evening, on their phone: the code from the big
 * screen typed in, the lobby, a timed question answered with one tap, and
 * the points and place that come back. Around it, the other ways the same
 * room takes part: live polls and an upvoted Q&A.
 */
export function ParticipantScene({ time, layout }: SceneProps) {
  const wide = layout === 'wide';
  const place = phonePlacement(layout);

  // The participants' card from the last scene becoming this phone.
  const arrive = useKeys(time, [18.3, 19.1], [0.72, 1], settle);
  const arriveOpacity = useKeys(time, [18.3, 18.75], [0, 1], linear);
  const scale = useTransform(arrive, (value) => value * place.scale);

  return (
    <Scene time={time} name="participant">
      <motion.div
        className="absolute"
        style={{
          left: place.left,
          top: place.top,
          scale,
          opacity: arriveOpacity,
          transformOrigin: wide ? '50% 50%' : '50% 0%',
        }}
      >
        <Phone width={PHONE_WIDTH}>
          <PhoneScreen time={time} from={JOIN} to={LOBBY}>
            <JoinScreen time={time} at={JOIN} />
          </PhoneScreen>
          <PhoneScreen time={time} from={LOBBY} to={QUESTION}>
            <LobbyScreen />
          </PhoneScreen>
          <PhoneScreen time={time} from={QUESTION} to={SENT}>
            <QuestionScreen time={time} openAt={QUESTION + 0.3} tapAt={TAP} />
          </PhoneScreen>
          <PhoneScreen time={time} from={SENT} to={RESULT}>
            <SentScreen />
          </PhoneScreen>
          <PhoneScreen time={time} from={RESULT}>
            <ResultScreen time={time} at={RESULT + 0.15} points={860} total={1640} rank={2} />
          </PhoneScreen>
        </Phone>
      </motion.div>

      <Captions time={time} wide={wide} />

      {wide ? (
        <>
          <PollCard time={time} at={21.6} />
          <QaCard time={time} at={22.4} />
        </>
      ) : (
        <ActivityChips time={time} at={22.6} />
      )}
    </Scene>
  );
}

function Captions({ time, wide }: { time: MotionValue<number>; wide: boolean }) {
  const t = useTranslations('explainer');
  const style = wide
    ? { left: 110, top: 300, width: 470, fontSize: 52 }
    : { left: 40, right: 40, top: 44, fontSize: 44, textAlign: 'center' as const };

  return (
    <>
      <div className="absolute font-semibold leading-[1.1]" style={style}>
        <Line time={time} at={19.1} until={22.4}>
          {t('joinCaption')}
        </Line>
        <Line time={time} at={19.6} until={22.4} className="text-muted-foreground">
          {t('joinCaptionBody')}
        </Line>
      </div>
      <div className="absolute font-semibold leading-[1.1]" style={style}>
        <Line time={time} at={22.8}>
          {t('playCaption')}
        </Line>
        <Line time={time} at={23.3} className="text-primary">
          {t('playCaptionBody')}
        </Line>
      </div>
    </>
  );
}

/** A gentle, constant float, so the panels feel held in space rather than pinned. */
function useFloat(time: MotionValue<number>, phase: number) {
  return useTransform(time, (now) => Math.sin(now * 0.9 + phase) * 6);
}

/** A live poll on the side: the same room, a different way to take part. */
function PollCard({ time, at }: { time: MotionValue<number>; at: number }) {
  const t = useTranslations('explainer');
  const tStatus = useTranslations('status');
  const enter = useEnter(time, at, { rise: 30 });
  const float = useFloat(time, 0);
  const y = useTransform([enter.y, float], ([a, b]) => (a as number) + (b as number));

  const options = [
    { key: 'pollA', share: 52 },
    { key: 'pollB', share: 31 },
    { key: 'pollC', share: 17 },
  ] as const;

  return (
    <motion.div
      className="absolute w-[400px] rounded-2xl border border-border bg-card p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]"
      style={{ left: 1090, top: 150, opacity: enter.opacity, y }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <LiveBadge label={tStatus('live')} />
        <span dir="ltr" className="font-mono text-[15px] text-muted-foreground">
          BRAVO-42
        </span>
      </div>
      <p className="text-[21px] font-semibold leading-snug">{t('pollTitle')}</p>
      <div className="mt-5 space-y-3.5">
        {options.map((option, index) => (
          <PollBar key={option.key} time={time} at={at + 0.5 + index * 0.15} label={t(option.key)} share={option.share} />
        ))}
      </div>
    </motion.div>
  );
}

function PollBar({ time, at, label, share }: { time: MotionValue<number>; at: number; label: string; share: number }) {
  const width = useKeys(time, [at, at + 1.1], ['0%', `${share}%`], settle);
  const value = useCount(time, 0, share, at, at + 1.1, (n) => `${n}%`);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[16px]">
        <span>{label}</span>
        <motion.span className="tabular-nums text-muted-foreground">{value}</motion.span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-primary" style={{ width }} />
      </div>
    </div>
  );
}

/** The Q&A, with a question climbing as someone upvotes it. */
function QaCard({ time, at }: { time: MotionValue<number>; at: number }) {
  const t = useTranslations('explainer');
  const enter = useEnter(time, at, { rise: 30 });
  const float = useFloat(time, 2);
  const y = useTransform([enter.y, float], ([a, b]) => (a as number) + (b as number));

  const upvoteAt = at + 1.6;
  const votes = useTransform(time, (now): string => (now >= upvoteAt ? '25' : '24'));
  const pop = useKeys(time, [upvoteAt, upvoteAt + 0.12, upvoteAt + 0.45], [1, 1.18, 1], [linear, spring]);
  const voted = useKeys(time, [upvoteAt, upvoteAt + 0.2], [0, 1], linear);

  return (
    <motion.div
      className="absolute w-[400px] rounded-2xl border border-border bg-card p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]"
      style={{ left: 1130, top: 500, opacity: enter.opacity, y }}
    >
      <p className="text-[17px] font-semibold text-muted-foreground">{t('qaTitle')}</p>
      <div className="mt-4 space-y-4">
        <div className="flex gap-3.5">
          <motion.span
            className="relative flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border text-[16px] font-semibold"
            style={{ scale: pop }}
          >
            <motion.span
              className="absolute inset-0 rounded-lg border-2 border-primary bg-primary-subtle"
              style={{ opacity: voted }}
            />
            <ArrowBigUp className="relative size-4 text-primary" aria-hidden />
            <motion.span className="relative tabular-nums">{votes}</motion.span>
          </motion.span>
          <p className="text-[17px] leading-snug">{t('qaOne')}</p>
        </div>
        <div className="flex gap-3.5">
          <span className="flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border text-[16px] font-semibold">
            <ArrowBigUp className="size-4 text-primary" aria-hidden />
            <span className="tabular-nums">17</span>
          </span>
          <p className="text-[17px] leading-snug">{t('qaTwo')}</p>
        </div>
      </div>
    </motion.div>
  );
}

/** On a phone-sized stage there is no room for panels: the activities, named. */
function ActivityChips({ time, at }: { time: MotionValue<number>; at: number }) {
  const t = useTranslations('types');
  const types = ['quiz', 'multiple_choice', 'q_and_a', 'word_cloud'] as const;
  return (
    <div className="absolute inset-x-0 flex flex-wrap justify-center gap-3" style={{ top: 1110 }}>
      {types.map((type, index) => (
        <Chip key={type} time={time} at={at + index * 0.12} label={t(`${type}.name`)} />
      ))}
    </div>
  );
}

function Chip({ time, at, label }: { time: MotionValue<number>; at: number; label: string }) {
  const enter = useEnter(time, at, { rise: 14 });
  return (
    <motion.span
      className="rounded-full border border-border bg-card px-5 py-2 text-[24px] font-medium"
      style={enter}
    >
      {label}
    </motion.span>
  );
}
