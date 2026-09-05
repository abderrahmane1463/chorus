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
 */
export function useEventSync(
  eventId: string,
  options: { channels?: string[]; onMessage?: (message: RealtimeMessage) => void } = {},
): ConnectionStatus {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onMessage = options.onMessage;

  const channelNames = options.channels ?? [`event-${eventId}`];

  const handle = useCallback(
    (message: RealtimeMessage) => {
      onMessage?.(message);

      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    },
    [router, onMessage],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return useRealtime(channelNames, handle);
}
