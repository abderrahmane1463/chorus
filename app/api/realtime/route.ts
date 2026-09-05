import type { NextRequest } from 'next/server';
import { bus } from '@/lib/realtime/bus';
import type { RealtimeMessage } from '@/lib/realtime/events';

// Must run on the Node runtime and stay dynamic: the stream is long-lived and
// reads from the in-process bus.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for the in-process realtime driver.
 * Used when Pusher is not configured. Subscribe with
 * `/api/realtime?channels=event-123,event-123-qa`.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('channels') ?? '';
  const channels = raw.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 8);

  if (channels.length === 0) {
    return new Response('channels query parameter is required', { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribes: Array<() => void> = [];
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // The client went away between the check and the write.
        }
      };

      send(': connected\n\n');

      // Deliberately unnamed. A named SSE event (`event: FOO`) is delivered
      // only to listeners registered for that exact name and never reaches
      // `onmessage`, so the event name travels inside the JSON payload instead.
      const onMessage = (message: RealtimeMessage) => {
        send(`data: ${JSON.stringify(message)}\n\n`);
      };

      unsubscribes = channels.map((channel) => bus.subscribe(channel, onMessage));

      // Keeps proxies from closing an idle connection.
      heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribes.forEach((fn) => fn());
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribes.forEach((fn) => fn());
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
