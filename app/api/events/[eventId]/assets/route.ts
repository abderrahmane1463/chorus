import { count, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { eventAssets } from '@/db/schema';
import { auth } from '@/lib/auth';
import { assertEventOwner } from '@/lib/queries/events';
import { take } from '@/lib/security/rate-limit';
import {
  ASSET_KINDS,
  ASSET_LIMITS,
  MAX_ASSETS_PER_EVENT,
  type AssetKind,
} from '@/lib/validations/branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The image formats accepted, each recognised by its first bytes.
 *
 * The declared content type is the uploader's claim; these signatures are
 * what the file actually is. SVG is left out on purpose: it can carry script,
 * and the browser turns one into a PNG before sending it anyway.
 */
function sniff(bytes: Uint8Array): string | null {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);

  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  // RIFF....WEBP
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}

function refuse(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

/**
 * Stores one image for an event's design and returns its id.
 *
 * The body is the image itself, already resized by the browser. Nothing is
 * shown to the audience until the design that names this id is saved.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return refuse(401, 'unauthorised');

  if (!take('uploadPerHost', session.user.id)) return refuse(429, 'slow-down');

  const { eventId } = await params;
  const owned = await assertEventOwner(eventId, session.user.id);
  if (!owned) return refuse(404, 'not-found');

  const kind = new URL(request.url).searchParams.get('kind') as AssetKind | null;
  if (!kind || !ASSET_KINDS.includes(kind)) return refuse(400, 'bad-kind');

  const limit = ASSET_LIMITS[kind].maxBytes;

  // Refused from the header first, so an oversized body is never read in.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > limit) return refuse(413, 'too-large');

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return refuse(400, 'empty');
  if (bytes.byteLength > limit) return refuse(413, 'too-large');

  const contentType = sniff(bytes);
  if (!contentType) return refuse(415, 'not-an-image');

  const [{ total }] = await db
    .select({ total: count() })
    .from(eventAssets)
    .where(eq(eventAssets.eventId, eventId));
  if (total >= MAX_ASSETS_PER_EVENT) return refuse(409, 'too-many');

  const [asset] = await db
    .insert(eventAssets)
    .values({
      eventId,
      kind,
      contentType,
      data: Buffer.from(bytes).toString('base64'),
      bytes: bytes.byteLength,
    })
    .returning({ id: eventAssets.id });

  return Response.json({ ok: true, id: asset.id });
}
