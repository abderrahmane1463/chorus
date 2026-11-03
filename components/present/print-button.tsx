'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** A4 in millimetres, and the margin kept round the page. */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const GAP = 4;

/**
 * Downloads the archive as a PDF file, built in the browser from the page.
 *
 * Each block marked `data-pdf-block` is drawn as an image, exactly as the
 * screen shows it (accents, Arabic, the fonts), then laid out on A4 pages:
 * `full` blocks span the page, `card` blocks flow in two columns. A block is
 * never split across two pages.
 */
export function PrintButton({
  label,
  busyLabel,
  failedLabel,
  filename,
  targetId,
}: {
  label: string;
  busyLabel: string;
  failedLabel: string;
  filename: string;
  /** The element holding the blocks, whose width is the page's width. */
  targetId: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    const root = document.getElementById(targetId);
    if (!root) return;
    setBusy(true);
    try {
      const [{ jsPDF }, { toJpeg, getFontEmbedCSS }] = await Promise.all([
        import('jspdf'),
        import('html-to-image'),
      ]);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const width = PAGE_W - 2 * MARGIN;
      const mmPerPx = width / root.getBoundingClientRect().width;
      // Fonts are read once and handed to every block, rather than per block.
      const fontEmbedCSS = await getFontEmbedCSS(root);

      let page = 0;
      let cursor = MARGIN;
      const columns = [MARGIN, MARGIN];
      const newPage = () => {
        if (page > 0) pdf.addPage();
        page += 1;
        cursor = MARGIN;
        columns[0] = columns[1] = MARGIN;
      };
      newPage();

      for (const block of root.querySelectorAll<HTMLElement>('[data-pdf-block]')) {
        const box = block.getBoundingClientRect();
        const w = box.width * mmPerPx;
        const h = box.height * mmPerPx;
        // JPEG: sharp enough for print at a tenth of a PNG's weight. The
        // block's own margin is dropped: kept, it pushes the content out of
        // the captured box, and the page spaces the blocks itself.
        const image = await toJpeg(block, {
          pixelRatio: 2,
          quality: 0.85,
          backgroundColor: '#ffffff',
          fontEmbedCSS,
          style: { margin: '0' },
        });

        if (block.dataset.pdfBlock === 'card') {
          const col = columns[0] <= columns[1] ? 0 : 1;
          if (columns.at(col)! + h > PAGE_H - MARGIN) newPage();
          const target = columns[0] <= columns[1] ? 0 : 1;
          const x = MARGIN + target * ((width + GAP) / 2);
          const y = columns.at(target)!;
          pdf.addImage(image, 'JPEG', x, y, w, h, undefined, 'FAST');
          columns[target] = y + h + GAP;
          cursor = Math.max(columns[0], columns[1]);
        } else {
          // A full-width block starts below both columns.
          const top = Math.max(cursor, columns[0], columns[1]);
          if (top + h > PAGE_H - MARGIN) newPage();
          const y = Math.max(cursor, columns[0], columns[1]);
          pdf.addImage(image, 'JPEG', MARGIN, y, Math.min(w, width), h, undefined, 'FAST');
          cursor = y + h + GAP;
          columns[0] = columns[1] = cursor;
        }
      }

      pdf.save(filename);
    } catch {
      toast.error(failedLabel);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={download} loading={busy}>
      <Download aria-hidden />
      {busy ? busyLabel : label}
    </Button>
  );
}
