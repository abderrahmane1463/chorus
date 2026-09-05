'use client';

import type { RealtimeMessage } from './events';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export type RealtimeHandler = (message: RealtimeMessage) => void;

export type RealtimeSubscription = {
  close: () => void;
};

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const clientDriver: 'pusher' | 'sse' =
  pusherKey && pusherCluster ? 'pusher' : 'sse';

/**
 * Subscribes to one or more channels using whichever driver is configured.
 * Both drivers report connection status so the UI can show a live indicator
 * and a reconnecting state.
 */
export function subscribe(
  channelNames: string[],
  onMessage: RealtimeHandler,
  onStatus: (status: ConnectionStatus) => void,
): RealtimeSubscription {
  if (clientDriver === 'pusher') {
    return subscribePusher(channelNames, onMessage, onStatus);
  }
  return subscribeSse(channelNames, onMessage, onStatus);
}

function subscribeSse(
  channelNames: string[],
  onMessage: RealtimeHandler,
  onStatus: (status: ConnectionStatus) => void,
): RealtimeSubscription {
  let source: EventSource | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout>;
  let attempts = 0;

  const connect = () => {
    if (closed) return;
    onStatus(attempts === 0 ? 'connecting' : 'reconnecting');

    source = new EventSource(
      `/api/realtime?channels=${encodeURIComponent(channelNames.join(','))}`,
    );

    source.onopen = () => {
      attempts = 0;
      onStatus('connected');
    };

    // The server sends unnamed events, so everything arrives here.
    source.onmessage = (raw) => {
      try {
        onMessage(JSON.parse(raw.data) as RealtimeMessage);
      } catch {
        // Ignore anything that isn't a well-formed message.
      }
    };

    source.onerror = () => {
      source?.close();
      if (closed) return;
      onStatus('reconnecting');
      // Back off, but stay responsive enough for a presenter mid-session.
      attempts += 1;
      const delay = Math.min(1000 * 2 ** (attempts - 1), 10_000);
      retry = setTimeout(connect, delay);
    };
  };

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(retry);
      source?.close();
    },
  };
}

function subscribePusher(
  channelNames: string[],
  onMessage: RealtimeHandler,
  onStatus: (status: ConnectionStatus) => void,
): RealtimeSubscription {
  let closed = false;
  let cleanup: (() => void) | null = null;

  void (async () => {
    const { default: Pusher } = await import('pusher-js');
    if (closed) return;

    const client = new Pusher(pusherKey!, { cluster: pusherCluster! });

    client.connection.bind('connected', () => onStatus('connected'));
    client.connection.bind('connecting', () => onStatus('reconnecting'));
    client.connection.bind('unavailable', () => onStatus('offline'));
    client.connection.bind('failed', () => onStatus('offline'));

    const subscribed = channelNames.map((name) => {
      const channel = client.subscribe(name);
      channel.bind_global((eventName: string, data: unknown) => {
        if (eventName.startsWith('pusher:')) return;
        onMessage(data as RealtimeMessage);
      });
      return name;
    });

    cleanup = () => {
      subscribed.forEach((name) => client.unsubscribe(name));
      client.disconnect();
    };
  })();

  return {
    close() {
      closed = true;
      cleanup?.();
    },
  };
}
