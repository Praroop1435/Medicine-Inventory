import { readFileSync } from 'fs';
import { join } from 'path';
import type { OcrLine } from '../OcrEngine';
import { parseBillText, qtyFromToken } from '../billParser';

const lines: OcrLine[] = readFileSync(
  join(__dirname, '../__fixtures__/bill-raj-pharma.txt'),
  'utf8',
)
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const [top, left, ...text] = l.split('|');
    return { top: Number(top), left: Number(left), text: text.join('|') };
  })
  // jitter within a row, as a real photo would
  .map((l, i) => ({ ...l, top: l.top + (i % 3) }));

describe('qtyFromToken', () => {
  it('parses plain, free and junk', () => {
    expect(qtyFromToken('10+1')).toBe(11);
    expect(qtyFromToken('10')).toBe(10);
    expect(qtyFromToken('x')).toBeNull();
  });
});

describe('parseBillText', () => {
  const { header, drafts } = parseBillText(lines);

  it('reads the header', () => {
    expect(header).toEqual({
      supplier: 'RAJ PHARMA DISTRIBUTORS',
      billNo: 'INV-2045',
      billDate: '12/10/2026',
    });
  });

  it('makes one draft per product row and none for totals/GST', () => {
    expect(drafts.map((d) => d.medicineName)).toEqual([
      'Crocin Advance',
      'Azithral 500',
      'Pan 40',
      'Dolo 650',
    ]);
  });

  it('reads batch, expiry and qty (+free)', () => {
    expect(drafts[0]).toMatchObject({
      batchNo: 'CR45A',
      expiry: { year: 2027, month: 8 },
      qty: 20,
      source: 'scan',
      uncertain: [],
    });
    expect(drafts[1]).toMatchObject({
      batchNo: 'AZ88',
      expiry: { year: 2026, month: 11 },
      qty: 11,
    });
  });

  it('flags unreadable expiry and qty', () => {
    expect(drafts[2]).toMatchObject({
      batchNo: 'PN7721',
      expiry: null,
      qty: 6,
      uncertain: ['expiry'],
    });
    expect(drafts[3]).toMatchObject({
      qty: null,
      expiry: { year: 2028, month: 3 },
      uncertain: ['qty'],
    });
  });

  it('returns nothing for an empty photo', () => {
    expect(parseBillText([])).toEqual({ header: {}, drafts: [] });
  });
});
