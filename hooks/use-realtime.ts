'use client';

import { useEffect, useRef, useState } from 'react';
import {
  subscribe,
  type ConnectionStatus,
  type RealtimeHandler,
} from '@/lib/realtime/client';

/**
 * Subscribes to realtime channels for the lifetime of a component.
 *
 * The handler is kept in a ref so callers can pass an inline function without
 * tearing down and rebuilding the connection on every render.
 */
export function useRealtime(channelNames: string[], onMessage: RealtimeHandler) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const handler = useRef<RealtimeHandler>(onMessage);

  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  const key = channelNames.join(',');

  useEffect(() => {
    if (!key) return;
    const subscription = subscribe(
      key.split(','),
      (message) => handler.current(message),
      setStatus,
    );
    return () => subscription.close();
  }, [key]);

  return status;
}
