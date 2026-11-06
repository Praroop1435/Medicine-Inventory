import type { OcrEngine, OcrLine } from '@/services/ocr/OcrEngine';
import type { PdfRenderer } from './PdfRenderer';

export const MAX_PDF_PAGES = 10;

const shift = (l: OcrLine, dy: number): OcrLine => ({
  ...l,
  top: l.top + dy,
  ...(l.corners && { corners: l.corners.map((c) => ({ x: c.x, y: c.y + dy })) }),
});

/** OCR each page and stack the pages top to bottom into one tall virtual page. */
export async function readPdfBill(
  uri: string,
  renderer: PdfRenderer,
  ocr: OcrEngine,
  onProgress: (page: number, total: number) => void = () => {},
): Promise<{ lines: OcrLine[]; truncated: boolean }> {
  const { pageCount, images } = await renderer.renderPages(uri, MAX_PDF_PAGES);
  const lines: OcrLine[] = [];
  let offset = 0;
  try {
    for (const [i, img] of images.entries()) {
      onProgress(i + 1, images.length);
      lines.push(...(await ocr.recognize(img.uri)).map((l) => shift(l, offset)));
      offset += img.height;
    }
  } finally {
    renderer.cleanup?.(images.map((i) => i.uri));
  }
  return { lines, truncated: pageCount > MAX_PDF_PAGES };
}
