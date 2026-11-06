import type { OcrEngine } from '@/services/ocr/OcrEngine';
import type { PdfRenderer } from '../PdfRenderer';
import { readPdfBill } from '../readPdfBill';

const renderer = (n: number, pageCount = n): PdfRenderer => ({
  renderPages: async () => ({
    pageCount,
    images: Array.from({ length: n }, (_, i) => ({ uri: `p${i}`, width: 600, height: 1000 })),
  }),
});
const ocr: OcrEngine = {
  recognize: async (uri) => [
    {
      text: uri,
      top: 5,
      left: 1,
      corners: [
        { x: 0, y: 5 },
        { x: 9, y: 15 },
      ],
    },
  ],
};

describe('readPdfBill', () => {
  it('offsets later pages by the cumulative height of earlier ones', async () => {
    const progress: [number, number][] = [];
    const { lines, truncated } = await readPdfBill('f.pdf', renderer(2), ocr, (p, t) =>
      progress.push([p, t]),
    );
    expect(lines.map((l) => [l.text, l.top])).toEqual([
      ['p0', 5],
      ['p1', 1005],
    ]);
    expect(lines[1]?.corners?.map((c) => c.y)).toEqual([1005, 1015]);
    expect(truncated).toBe(false);
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('reads the first 10 pages and flags a longer PDF', async () => {
    const { lines, truncated } = await readPdfBill('f.pdf', renderer(10, 11), ocr);
    expect(lines).toHaveLength(10);
    expect(truncated).toBe(true);
  });
});
