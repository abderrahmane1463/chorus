'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { useRealtime } from './use-realtime';
import type { RealtimeMessage } from '@/lib/realtime/events';
import type { ConnectionStatus } from '@/lib/realtime/client';

/** Messages arriving in a burst (a room voting at once) collapse into one refetch. */
const REFRESH_DEBOUNCE_MS = 220;

/**
 * Keeps a server-rendered page in step with an event.
 *
 * Realtime messages only say *that* something changed; this refetches the page
 * from the server to find out what. That means a dropped or duplicated message
 * can never leave a client showing numbers the database does not agree with.
 *
 * A message can still be missed outright: nothing is replayed to a phone that
 * was locked, in another app, or offline when it was sent. So the page also
 * refetches whenever it could have missed one — each time the connection
 * opens, and each time the page comes back into view. Without that, a
 * participant who glanced away while the host pressed Start would sit on the
 * old screen until something else happened to change.
 */
export function useEventSync(
  eventId: string,
  options: { channels?: string[]; onMessage?: (message: RealtimeMessage) => void } = {},
): ConnectionStatus {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onMessage = options.onMessage;

  const channelNames = options.channels ?? [`event-${eventId}`];

  const scheduleRefresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
  }, [router]);

  const handle = useCallback(
    (message: RealtimeMessage) => {
      onMessage?.(message);
      scheduleRefresh();
    },
    [onMessage, scheduleRefresh],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const status = useRealtime(channelNames, handle);

  // The connection has just opened, for the first time or after a drop.
  // Anything published before this moment never reached this page: on first
  // load that is the gap between the server rendering it and the connection
  // opening, which on a slow phone is long enough to miss a Start.
  useEffect(() => {
    if (status === 'connected') scheduleRefresh();
  }, [status, scheduleRefresh]);

  // Browsers suspend a hidden page, so its connection may look open while
  // nothing was being delivered. Coming back into view is the cue to check.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [scheduleRefresh]);

  return status;
}
