import type { NextRequest } from 'next/server';
import { bus } from '@/lib/realtime/bus';
import { keepDatabaseWarm } from '@/lib/db/keep-warm';
import type { RealtimeMessage } from '@/lib/realtime/events';
import { clientAddress } from '@/lib/security/rate-limit';

// Must run on the Node runtime and stay dynamic: the stream is long-lived and
// reads from the in-process bus.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

/**
 * Open streams allowed at once. A whole room joins from the venue's one
 * Wi-Fi address, so the per-address limit is generous: it only stops one
 * script opening streams by the thousand. The overall limit keeps the
 * server's memory and sockets safe whatever happens; it sits well above the
 * largest room tested. A phone refused here shows "reconnecting" and tries
 * again every few seconds, so it gets in as soon as a place frees up.
 */
const MAX_STREAMS = 4000;
const MAX_STREAMS_PER_ADDRESS = 1500;

const globalRef = globalThis as unknown as {
  __streams?: { total: number; byAddress: Map<string, number> };
};
const open = (globalRef.__streams ??= { total: 0, byAddress: new Map() });

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

  const address = clientAddress(request.headers);
  const fromAddress = open.byAddress.get(address) ?? 0;
  if (open.total >= MAX_STREAMS || fromAddress >= MAX_STREAMS_PER_ADDRESS) {
    return new Response('Too many live connections', {
      status: 429,
      headers: { 'retry-after': '30' },
    });
  }
  open.total++;
  open.byAddress.set(address, fromAddress + 1);

  // Abort and cancel can both fire for one stream: count it closed once.
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearInterval(heartbeat);
    unsubscribes.forEach((fn) => fn());
    open.total--;
    const left = (open.byAddress.get(address) ?? 1) - 1;
    if (left > 0) open.byAddress.set(address, left);
    else open.byAddress.delete(address);
  };

  // Someone is watching live: keep the database awake while anyone is.
  keepDatabaseWarm();

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
        release();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      release();
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
