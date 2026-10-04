'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { removeParticipantAction } from '@/lib/actions/participant';
import type { LobbyPlayer } from '@/lib/queries/quiz';
import { cn } from '@/lib/utils/cn';

/** How long the "remove?" state waits for the second click before giving up. */
const CONFIRM_MS = 4000;

/**
 * One player's name in a quiz lobby, with a way for the host to remove them.
 *
 * Removing takes two clicks on the same spot: the first turns the chip red
 * and asks, the second removes. A stray click on a crowded list of names
 * should not throw someone out of the room.
 *
 * On the big screen the control is hidden until the host points at a name,
 * so the room sees a list of players and not a row of delete buttons.
 */
export function PlayerChip({ player, size }: { player: LobbyPlayer; size: 'sm' | 'lg' }) {
  const t = useTranslations('players');
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemoving] = useTransition();
  const name = player.displayName ?? t('anonymous');
  const large = size === 'lg';

  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timeout);
  }, [confirming]);

  function remove() {
    startRemoving(async () => {
      const result = await removeParticipantAction({ participantId: player.id });
      if (result.ok) {
        toast.success(t('removed', { name }));
      } else {
        setConfirming(false);
        toast.error(result.error);
      }
    });
  }

  return (
    <span
      className={cn(
        'group inline-flex items-center rounded-full border font-medium transition-colors',
        large ? 'gap-2 py-2 ps-4 pe-2 text-xl' : 'gap-1 py-1 ps-3 pe-1 text-sm',
        confirming
          ? 'border-destructive bg-destructive-subtle text-destructive'
          : 'border-border bg-card',
        removing && 'opacity-50',
      )}
    >
      {/* A name keeps its own script's direction inside any page. */}
      <bdi>{name}</bdi>
      <button
        type="button"
        onClick={confirming ? remove : () => setConfirming(true)}
        disabled={removing}
        aria-label={confirming ? t('confirmRemove', { name }) : t('remove', { name })}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full transition',
          large ? 'size-8' : 'size-6',
          large && !confirming && 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
          confirming
            ? 'bg-destructive text-white'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {confirming ? (
          <Check className={large ? 'size-5' : 'size-3.5'} aria-hidden />
        ) : (
          <X className={large ? 'size-5' : 'size-3.5'} aria-hidden />
        )}
      </button>
    </span>
  );
}
