/**
 * Regenerates the raster icons from app/icon.svg. Run after changing the mark:
 *
 *   npm run icons
 *
 * - app/favicon.ico   16, 32 and 48px, for browsers without SVG favicons
 * - app/apple-icon.png 180px, for iOS home screens
 *
 * Next serves all three from app/ automatically; there is nothing to register.
 */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('app/icon.svg', 'utf8');

// iOS masks its own rounded corners, and a transparent corner would show as
// black there, so the home-screen icon is a full-bleed square.
const fullBleed = svg.replace(/<rect width="32" height="32" rx="7"/, '<rect width="32" height="32"');

// Rasterised straight at the target size. Rendering large and shrinking
// resamples the edges, which blurs a 2px bar at 16px.
const png = (source, size) =>
  sharp(Buffer.from(source), { density: 72 * (size / 32) })
    .resize(size, size)
    .png()
    .toBuffer();

/** ICO with PNG entries, which every browser that still wants an .ico reads. */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // width, 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    header.writeUInt8(0, entry + 2); // palette size
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map(async (size) => ({ size, data: await png(svg, size) })),
);

await writeFile('app/favicon.ico', ico(images));
await writeFile('app/apple-icon.png', await png(fullBleed, 180));

console.log('Wrote app/favicon.ico (16, 32, 48) and app/apple-icon.png (180)');
