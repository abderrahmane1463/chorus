'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { HEARTBEAT_SECONDS } from '@/lib/participant/presence';

/**
 * Tells the server this participant is still in the room.
 *
 * Only while the page is visible: a locked phone or one switched to another
 * app is not taking part, and should drop out of the count rather than hold
 * a quiz open for an answer that is not coming. It signals again the moment
 * it is back in view.
 *
 * When the server no longer knows this participant, the host removed them;
 * refetching the page sends them back to the join screen.
 */
export function usePresence(eventId: string) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;

    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      const response = await fetch(`/api/events/${eventId}/presence`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => null);
      if (!stopped && response?.status === 410) router.refresh();
    };

    void beat();
    const interval = setInterval(beat, HEARTBEAT_SECONDS * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void beat();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [eventId, router]);
}

/** Mounts the heartbeat on a server-rendered page. Renders nothing. */
export function Presence({ eventId }: { eventId: string }) {
  usePresence(eventId);
  return null;
}
