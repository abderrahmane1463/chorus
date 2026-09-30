import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { eventAssets } from '@/db/schema';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serves an event's uploaded image.
 *
 * Public: these are the logos and backdrop the audience sees, and the id is
 * random. An image never changes once stored (a replacement gets a new id),
 * so browsers may keep it for good and a room of phones asks only once each.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  if (!UUID.test(assetId)) return new Response('Not found', { status: 404 });

  const [asset] = await db
    .select({ contentType: eventAssets.contentType, data: eventAssets.data })
    .from(eventAssets)
    .where(eq(eventAssets.id, assetId))
    .limit(1);

  if (!asset) return new Response('Not found', { status: 404 });

  return new Response(Buffer.from(asset.data, 'base64'), {
    headers: {
      'content-type': asset.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      // Only ever an image: never let a browser guess it is something else.
      'x-content-type-options': 'nosniff',
    },
  });
}
