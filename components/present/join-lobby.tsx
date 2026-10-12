'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PlayerChip } from '@/components/quiz/player-chip';
import { startInteractionAction } from '@/lib/actions/interaction';
import type { LobbyPlayer } from '@/lib/queries/quiz';

/**
 * The big screen while a question gathers its room: how to join, in the
 * middle where everyone can scan it, and the names arriving under it. The
 * question reaches the phones when the host presses Start.
 */
export function JoinLobby({
  interactionId,
  players,
  playerTotal,
  joinUrl,
  eventCode,
}: {
  interactionId: string;
  players: LobbyPlayer[];
  playerTotal: number;
  joinUrl: string;
  eventCode: string;
}) {
  const t = useTranslations('lobby');
  const tp = useTranslations('presenter');
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [starting, startTransition] = useTransition();
  const hidden = playerTotal - players.length;

  function start() {
    startTransition(async () => {
      const result = await startInteractionAction({ interactionId });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <div
      className="flex flex-col items-center text-center"
      // The code and the names share the screen's height: the code as large
      // as it allows (full size on a 1080p projector, smaller on 720p), the
      // names what is left, so Start never drops off the bottom.
      style={{ ['--qr' as string]: 'clamp(120px, calc(100dvh - 615px), 300px)' }}
    >
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <QRCodeSVG
          value={joinUrl}
          size={300}
          level="M"
          className="h-auto"
          style={{ width: 'var(--qr)' }}
        />
      </div>

      <p className="mt-4 text-2xl text-muted-foreground">
        {tp('joinAt')}{' '}
        <span dir="ltr" className="font-medium text-foreground">
          {joinUrl.replace(/^https?:\/\//, '').replace(/\/event\/.*$/, '')}
        </span>
      </p>
      <p dir="ltr" className="mt-1 font-mono text-5xl font-semibold tracking-widest">
        {eventCode}
      </p>

      <p className="mt-4 inline-flex items-center gap-2 text-2xl text-muted-foreground">
        <Users className="size-6" aria-hidden />
        {/* aria-live so a screen reader hears the room filling. */}
        <span aria-live="polite">{t('joined', { count: playerTotal })}</span>
      </p>

      <ul
        className="mt-3 flex max-w-4xl flex-wrap justify-center gap-2.5 overflow-hidden"
        style={{ maxHeight: 'clamp(3.25rem, calc(100dvh - 560px - var(--qr)), 10rem)' }}
      >
        {/* initial={false}: names already here on load simply appear; only
            the ones that join while the room watches pop in. */}
        <AnimatePresence initial={false}>
          {players.map((player) => (
            <motion.li
              key={player.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            >
              <PlayerChip player={player} size="lg" />
            </motion.li>
          ))}
        </AnimatePresence>
        {hidden > 0 && (
          <li className="rounded-full px-4 py-2 text-xl text-muted-foreground">
            {tp('morePlayers', { count: hidden })}
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="mt-4 inline-flex items-center gap-3 rounded-xl bg-primary px-10 py-4 text-2xl font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        <Play className="size-6" aria-hidden />
        {t('start')}
      </button>
      <p className="mt-2 text-lg text-muted-foreground">{t('hint')}</p>
    </div>
  );
}
