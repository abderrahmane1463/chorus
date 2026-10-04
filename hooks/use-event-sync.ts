'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRealtime } from './use-realtime';
import type { RealtimeEventName, RealtimeMessage } from '@/lib/realtime/events';
import type { ConnectionStatus } from '@/lib/realtime/client';

/** Messages arriving in a burst (a room voting at once) collapse into one refetch. */
const REFRESH_DEBOUNCE_MS = 220;

/**
 * The least time between two refetches by one screen.
 *
 * A refetch re-renders the page on the server, so a room of phones each
 * refetching on every message is the one thing that can bring the server
 * down: the work grows with the number of people times the number of things
 * they do. Debouncing alone does not bound it, because messages that arrive
 * further apart than the debounce each cost a refetch. This does bound it,
 * at one per screen per interval, and nothing is lost: the refetch that
 * eventually runs reads the current state, not the state at the message.
 */
const MIN_REFRESH_INTERVAL_MS = 1000;

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
  options: {
    channels?: string[];
    onMessage?: (message: RealtimeMessage) => void;
    /**
     * Messages this screen listens for but does not refetch for, because they
     * change nothing it shows. A phone during a quiz question is the case
     * that matters: it displays nothing about anyone else's answer, so
     * refetching for each of them is work every player pays for every player.
     */
    ignore?: readonly RealtimeEventName[];
  } = {},
): ConnectionStatus {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastRefresh = useRef(0);
  const onMessage = options.onMessage;

  const channelNames = options.channels ?? [`event-${eventId}`];

  // Compared by content: callers build the list inline on every render.
  const ignoreKey = options.ignore?.join(',') ?? '';
  const ignored = useMemo(
    () => new Set(ignoreKey ? ignoreKey.split(',') : []),
    [ignoreKey],
  );

  const scheduleRefresh = useCallback(() => {
    clearTimeout(timer.current);
    const sinceLast = Date.now() - lastRefresh.current;
    const wait = Math.max(REFRESH_DEBOUNCE_MS, MIN_REFRESH_INTERVAL_MS - sinceLast);

    timer.current = setTimeout(() => {
      lastRefresh.current = Date.now();
      router.refresh();
    }, wait);
  }, [router]);

  const handle = useCallback(
    (message: RealtimeMessage) => {
      onMessage?.(message);
      if (!ignored.has(message.event)) scheduleRefresh();
    },
    [onMessage, scheduleRefresh, ignored],
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
