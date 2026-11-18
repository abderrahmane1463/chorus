import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { participants } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { readSessionId } from '@/lib/participant/session';
import { assertEventOwner } from '@/lib/queries/events';
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

/**
 * Streams one person may hold: a phone needs one (two while a page
 * reloads); a host may have the dashboard, the presenter and a spare screen
 * open at once.
 */
const MAX_STREAMS_PER_PARTICIPANT = 3;
const MAX_STREAMS_PER_HOST = 20;

/**
 * Messages a stream may hold for a client that is not reading. A connected
 * phone takes each one within milliseconds; one that stops reading while
 * keeping the connection open would otherwise make this process keep every
 * message for it, for as long as it stays. Past this it is disconnected and
 * its browser reconnects, fetching the current state, if it is still there.
 */
const MAX_BACKLOG = 64;

/** `event-<uuid>` with an optional `-qa`, `-quiz` or `-host`; see lib/realtime/events. */
const CHANNEL = /^event-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-(qa|quiz|host))?$/;

const globalRef = globalThis as unknown as {
  __streams?: { total: number; byAddress: Map<string, number>; byPerson: Map<string, number> };
};
const open = (globalRef.__streams ??= { total: 0, byAddress: new Map(), byPerson: new Map() });
open.byPerson ??= new Map();

/**
 * Who is asking, for this event: its host (every channel) or one of its
 * participants (all but the host channel), else nobody.
 */
async function viewerOf(eventId: string): Promise<{ key: string; host: boolean } | null> {
  const user = await currentUser();
  if (user && (await assertEventOwner(eventId, user.id))) {
    return { key: `host:${user.id}`, host: true };
  }
  const sessionId = await readSessionId();
  if (!sessionId) return null;
  const [joined] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.sessionId, sessionId)))
    .limit(1);
  return joined ? { key: `participant:${joined.id}`, host: false } : null;
}

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

  // One event per stream, named by real channel names only.
  const parsed = channels.map((channel) => CHANNEL.exec(channel));
  const eventId = parsed[0]?.[1];
  if (!eventId || parsed.some((match) => !match || match[1] !== eventId)) {
    return new Response('Unknown channel', { status: 400 });
  }

  // Only the event's host and its joined participants may listen, so a
  // stranger cannot take up the connections a live room needs.
  const viewer = await viewerOf(eventId);
  if (!viewer) return new Response('Not a participant of this event', { status: 403 });
  if (!viewer.host && parsed.some((match) => match?.[2] === 'host')) {
    return new Response('Host channel', { status: 403 });
  }

  const address = clientAddress(request.headers);
  const fromAddress = open.byAddress.get(address) ?? 0;
  const fromPerson = open.byPerson.get(viewer.key) ?? 0;
  const perPerson = viewer.host ? MAX_STREAMS_PER_HOST : MAX_STREAMS_PER_PARTICIPANT;
  if (
    open.total >= MAX_STREAMS ||
    fromAddress >= MAX_STREAMS_PER_ADDRESS ||
    fromPerson >= perPerson
  ) {
    return new Response('Too many live connections', {
      status: 429,
      headers: { 'retry-after': '30' },
    });
  }
  open.total++;
  open.byAddress.set(address, fromAddress + 1);
  open.byPerson.set(viewer.key, fromPerson + 1);

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
    const personLeft = (open.byPerson.get(viewer.key) ?? 1) - 1;
    if (personLeft > 0) open.byPerson.set(viewer.key, personLeft);
    else open.byPerson.delete(viewer.key);
  };

  // Someone is watching live: keep the database awake while anyone is.
  keepDatabaseWarm();

  const encoder = new TextEncoder();
  let unsubscribes: Array<() => void> = [];
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        // A client this far behind has stopped reading: drop it (and what
        // it has queued) rather than keep buffering for it. See MAX_BACKLOG.
        const room = controller.desiredSize;
        if (room !== null && room < -MAX_BACKLOG) {
          release();
          try {
            controller.error(new Error('client stopped reading'));
          } catch {
            // Already closed.
          }
          return;
        }
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
