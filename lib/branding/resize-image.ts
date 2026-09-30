import { ASSET_LIMITS, type AssetKind } from '@/lib/validations/branding';

/**
 * Shrinks a picked image in the browser before it is uploaded.
 *
 * A logo straight from a designer can be several megabytes and thousands of
 * pixels wide, to be shown 40 pixels tall. Drawing it onto a canvas at the
 * size it will be used turns that into a few kilobytes, and also turns any
 * format the browser can display (SVG included) into a plain raster image,
 * which is all the server accepts.
 */
export async function resizeForUpload(file: File, kind: AssetKind): Promise<Blob> {
  const { maxEdge, maxBytes } = ASSET_LIMITS[kind];
  const image = await load(file);

  const width = image.naturalWidth || maxEdge;
  const height = image.naturalHeight || maxEdge;
  const scale = Math.min(1, maxEdge / Math.max(width, height));

  // A photo has no transparency to keep, so it takes JPEG, which is far
  // smaller. Logos keep their transparent background.
  const formats: [string, number | undefined][] =
    kind === 'background'
      ? [['image/jpeg', 0.82], ['image/jpeg', 0.65]]
      : [['image/webp', 0.9], ['image/png', undefined]];

  let smallest: Blob | null = null;

  // Tried at the full target size first, then smaller, until it fits.
  for (const shrink of [1, 0.75, 0.5]) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale * shrink));
    canvas.height = Math.max(1, Math.round(height * scale * shrink));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('no-canvas');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const [type, quality] of formats) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, quality),
      );
      if (!blob) continue;
      if (blob.size <= maxBytes) return blob;
      if (!smallest || blob.size < smallest.size) smallest = blob;
    }
  }

  // Still too large: send the best attempt and let the server say so.
  if (!smallest) throw new Error('not-an-image');
  return smallest;
}

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not-an-image'));
    };
    image.src = url;
  });
}
