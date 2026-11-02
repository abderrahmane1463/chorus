import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionId, setKioskCode } from '@/lib/participant/session';
import { normalizeEventCode } from '@/lib/utils/event-code';

/**
 * The kiosk link of an event, opened once on a shared tablet.
 *
 * Marks the device as that event's kiosk, forgets any visitor still on it and
 * sends it to the join screen. From then on, each visitor joins, takes part,
 * and the tablet resets for the next. `?exit=1` turns the device back into an
 * ordinary one.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> },
) {
  const { eventCode } = await params;
  const code = normalizeEventCode(eventCode);
  const exit = request.nextUrl.searchParams.get('exit') === '1';

  await setKioskCode(exit ? null : code);
  await clearSessionId();

  // A relative location: behind the host's proxy, the request's own origin
  // is the app's internal address, not the one the tablet reached.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: `/join?code=${encodeURIComponent(code)}` },
  });
}
