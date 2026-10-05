import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { participants } from '@/db/schema';
import { readSessionId } from '@/lib/participant/session';
import { seenNow } from '@/lib/queries/presence';
import { take } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A participant's phone saying it is still in the room.
 *
 * A plain route rather than a Server Action: it is called every half
 * minute by every phone, so it should cost one small update and nothing
 * else. The participant is found by their signed cookie, never by an id the
 * browser sends.
 *
 * 410 Gone means there is no such participant any more, which is how a
 * phone learns that the host removed it.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  if (!UUID.test(eventId)) return new Response(null, { status: 404 });

  const sessionId = await readSessionId();
  if (!sessionId) return new Response(null, { status: 401 });
  if (!take('presencePerPlayer', sessionId)) return new Response(null, { status: 429 });

  const touched = await db
    .update(participants)
    .set({ lastSeenAt: seenNow })
    .where(and(eq(participants.eventId, eventId), eq(participants.sessionId, sessionId)))
    .returning({ id: participants.id });

  return new Response(null, { status: touched.length > 0 ? 204 : 410 });
}
