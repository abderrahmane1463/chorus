import 'server-only';
import { bus } from './bus';
import type { RealtimeEventName, RealtimeMessage } from './events';

const pusherConfigured = Boolean(
  process.env.PUSHER_APP_ID &&
    process.env.PUSHER_SECRET &&
    process.env.NEXT_PUBLIC_PUSHER_KEY &&
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
);

/** Whether messages fan out across instances (Pusher) or stay in-process (SSE). */
export const realtimeDriver: 'pusher' | 'sse' = pusherConfigured ? 'pusher' : 'sse';

type PusherServer = { trigger: (c: string, e: string, d: unknown) => Promise<unknown> };
let pusherClient: PusherServer | null = null;

async function getPusher(): Promise<PusherServer> {
  if (!pusherClient) {
    const { default: Pusher } = await import('pusher');
    pusherClient = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    }) as unknown as PusherServer;
  }
  return pusherClient;
}

/**
 * Publishes a change notification after the database write has committed.
 * Never call this before persisting: the database is the source of truth and
 * clients refetch as soon as they hear from us.
 */
export async function publish(
  channel: string,
  event: RealtimeEventName,
  payload: Omit<RealtimeMessage, 'event' | 'at'>,
): Promise<void> {
  const message: RealtimeMessage = { ...payload, event, at: Date.now() };

  if (realtimeDriver === 'pusher') {
    try {
      const pusher = await getPusher();
      await pusher.trigger(channel, event, message);
      return;
    } catch (error) {
      // A realtime outage must never fail the user's write.
      console.error('[realtime] pusher publish failed', error);
    }
  }

  bus.publish(channel, message);
}
