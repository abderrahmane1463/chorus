'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { usePlayhead } from './motion';
import { CHAPTERS, DURATION, POSTER_TIME, STAGE, type Layout } from './timeline';
import { EventScene, IntroScene } from './scenes/opening';
import { FlowScene } from './scenes/flow';
import { ParticipantScene } from './scenes/participant';
import { LiveScene } from './scenes/live';
import { OrganizerScene } from './scenes/organizer';
import { BigPictureScene, BrandScene } from './scenes/ending';

/** Below this width the film switches to its tall composition. */
const TALL_BELOW = 600;

/**
 * The Chorus explainer: a film drawn live in the page, from the product's
 * own screens, words and colours. Muted by nature, it plays on its own
 * while it is on screen, loops, and stops when scrolled past. With reduced
 * motion it shows its closing frame and waits to be played.
 */
export function Explainer({ partnerLogo }: { partnerLogo: string | null }) {
  const t = useTranslations('explainer');
  const reduced = useReducedMotion() ?? false;
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const resize = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    const watch = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    resize.observe(node);
    watch.observe(node);
    return () => {
      resize.disconnect();
      watch.disconnect();
    };
  }, []);

  const { time, wantsToPlay, play, pause, seek } = usePlayhead(DURATION, { autoplay: !reduced, visible });

  // With reduced motion, the film waits on its closing frame.
  useEffect(() => {
    if (reduced) {
      pause();
      seek(POSTER_TIME);
    }
  }, [reduced, pause, seek]);

  const layout: Layout = width > 0 && width < TALL_BELOW ? 'tall' : 'wide';
  const stage = STAGE[layout];
  const scale = width / stage.width;

  const [chapter, setChapter] = useState(0);
  useMotionValueEvent(time, 'change', (now) => {
    const index = CHAPTERS.findLastIndex((entry) => now >= entry.at);
    if (index !== chapter) setChapter(Math.max(0, index));
  });
  const progress = useTransform(time, (now) => now / DURATION);

  return (
    <figure className="m-0">
      <div
        ref={frame}
        className="dark relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-[0_40px_120px_-40px_rgba(4,33,29,0.55)] sm:aspect-video"
        aria-hidden
      >
        <Backdrop />
        {width > 0 && (
          <div
            className="absolute left-0 top-0 origin-top-left [&_*]:[unicode-bidi:plaintext]"
            style={{ width: stage.width, height: stage.height, transform: `scale(${scale})` }}
            // The stage is laid out left to right in every language; each line of copy still takes its direction from its own words.
            dir="ltr"
          >
            <IntroScene time={time} layout={layout} />
            <EventScene time={time} layout={layout} />
            <FlowScene time={time} layout={layout} />
            <ParticipantScene time={time} layout={layout} />
            <LiveScene time={time} layout={layout} />
            <OrganizerScene time={time} layout={layout} />
            <BigPictureScene time={time} layout={layout} />
            <BrandScene time={time} layout={layout} partnerLogo={partnerLogo} />
          </div>
        )}
      </div>

      <figcaption className="sr-only">{t('summary')}</figcaption>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={wantsToPlay ? pause : play}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          aria-label={wantsToPlay ? t('pause') : t('play')}
        >
          {wantsToPlay ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 translate-x-px rtl:-scale-x-100" aria-hidden />}
        </button>

        <div className="relative flex h-10 flex-1 items-center" dir="ltr">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full origin-left rounded-full bg-primary" style={{ scaleX: progress }} />
          </div>
          {CHAPTERS.map((entry, index) => (
            <button
              key={entry.name}
              type="button"
              onClick={() => {
                seek(entry.at + 0.5);
                play();
              }}
              className={cn(
                'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-transform hover:scale-125',
                index <= chapter ? 'bg-primary' : 'bg-border',
              )}
              style={{ left: `${(entry.at / DURATION) * 100}%` }}
              aria-label={t('chapter', { name: t(`chapters.${entry.name}`) })}
            />
          ))}
        </div>

        <span className="hidden w-36 truncate text-sm text-muted-foreground sm:block" aria-live="off">
          {t(`chapters.${CHAPTERS[chapter].name}`)}
        </span>

        <button
          type="button"
          onClick={() => {
            seek(0);
            play();
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('replay')}
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
      </div>
    </figure>
  );
}

/** The film's room: a faint dot grid and two slow pools of the brand's light. */
function Backdrop() {
  return (
    <>
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div
        className="absolute -left-1/4 -top-1/3 h-[80%] w-[70%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--primary) 18%, transparent), transparent)' }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[70%] w-[60%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 10%, transparent), transparent)' }}
      />
    </>
  );
}
