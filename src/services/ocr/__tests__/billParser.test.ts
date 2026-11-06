import { readFileSync } from 'fs';
import { join } from 'path';
import type { OcrLine } from '../OcrEngine';
import { normalizeOrientation, parseBillText, qtyFromToken } from '../billParser';
import {
  centredRightBillLines,
  leftLabelBillLines,
  realBillLines,
  rotated,
} from '../__fixtures__/real-bill-swastik';

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
      uncertain: ['expiry', 'batchNo'],
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
      uncertain: ['expiry', 'batchNo'],
    });
    expect(drafts[3]).toMatchObject({
      qty: null,
      expiry: { year: 2028, month: 3 },
      uncertain: ['expiry', 'batchNo', 'qty'],
    });
  });

  it('returns nothing for an empty photo', () => {
    expect(parseBillText([])).toEqual({ header: {}, drafts: [] });
  });
});

describe('column rules', () => {
  const at = (top: number, cells: [number, string][]): OcrLine[] =>
    cells.map(([left, text]) => ({ top, left, text }));
  const head = at(10, [[0, 'SHOP']]);
  const cols = at(40, [
    [0, 'Product'],
    [100, 'Batch'],
    [200, 'Exp'],
    [300, 'Qty'],
    [400, 'Free'],
    [500, 'Rate'],
  ]);
  const one = (lines: OcrLine[]) => parseBillText([...head, ...lines]).drafts[0];

  it('every scan row flags expiry and batchNo', () => {
    for (const d of parseBillText(lines).drafts)
      expect(d.uncertain).toEqual(expect.arrayContaining(['expiry', 'batchNo']));
  });

  it('integer rate with blank free does not inflate qty', () => {
    const d = one([
      ...cols,
      ...at(70, [
        [0, 'Crocin'],
        [100, 'A1'],
        [200, '08/27'],
        [300, '10'],
        [500, '98'],
      ]),
    ]);
    expect(d.qty).toBe(10);
    expect(d.uncertain).not.toContain('qty');
  });

  it('unreadable qty with integer rate is null and flagged, with or without headers', () => {
    const row = at(70, [
      [0, 'Crocin'],
      [100, 'A1'],
      [200, '08/27'],
      [300, 'x'],
      [500, '98'],
    ]);
    for (const lines of [[...cols, ...row], row]) {
      const d = one(lines);
      expect(d.qty).toBeNull();
      expect(d.uncertain).toContain('qty');
    }
  });

  it('takes free only from the Free column or an a+b token', () => {
    expect(
      one([
        ...cols,
        ...at(70, [
          [0, 'X'],
          [100, 'A1'],
          [200, '08/27'],
          [300, '5'],
          [400, '1'],
          [500, '98'],
        ]),
      ]).qty,
    ).toBe(6);
    expect(
      one([
        ...cols,
        ...at(70, [
          [0, 'X'],
          [100, 'A1'],
          [200, '08/27'],
          [300, '10+1'],
          [500, '98'],
        ]),
      ]).qty,
    ).toBe(11);
  });

  it('garbled/missing Free header: free not added, ambiguous qty flagged', () => {
    const garbled = at(40, [
      [0, 'Product'],
      [100, 'Batch'],
      [200, 'Exp'],
      [300, 'Qty'],
      [400, 'Fr3e'],
    ]);
    const d = one([
      ...garbled,
      ...at(70, [
        [0, 'X'],
        [100, 'A1'],
        [200, '08/27'],
        [300, '5'],
        [400, '1'],
      ]),
    ]);
    expect(d.qty).toBe(5);
    const noHeaders = one(
      at(70, [
        [0, 'X'],
        [100, 'A1'],
        [200, '08/27'],
        [300, '5'],
        [400, '1'],
        [500, '98'],
      ]),
    );
    expect(noHeaders.qty).toBe(5);
    expect(noHeaders.uncertain).toContain('qty');
  });

  it('flags qty when OCR splits the QTY cell or garbles Free, and still reads "20 + 20"', () => {
    const d = one([
      ...cols,
      ...at(70, [
        [0, 'X'],
        [100, 'A1'],
        [200, '08/27'],
        [300, '20'],
        [315, '+'],
        [325, '20'],
      ]),
    ]);
    expect(d.qty).toBe(40);
    expect(d.uncertain).toContain('qty');
    const badFree = one([
      ...cols,
      ...at(70, [
        [0, 'X'],
        [100, 'A1'],
        [200, '08/27'],
        [300, '5'],
        [400, 'l'],
      ]),
    ]);
    expect(badFree.qty).toBe(5);
    expect(badFree.uncertain).toContain('qty');
  });

  it('uses the Batch column over a batch-like name word', () => {
    const d = one([
      ...cols,
      ...at(70, [
        [0, 'Vitamin'],
        [40, 'D3'],
        [100, 'ZX9'],
        [200, '08/27'],
        [300, '2'],
      ]),
    ]);
    expect(d.batchNo).toBe('ZX9');
    expect(d.medicineName).toBe('Vitamin D3');
    expect(d.uncertain).toContain('batchNo');
  });

  it('no Qty header: one integer after expiry is kept but flagged', () => {
    const d = one(
      at(70, [
        [0, 'X'],
        [100, 'A1'],
        [200, '08/27'],
        [300, '98'],
      ]),
    );
    expect(d.qty).toBe(98);
    expect(d.uncertain).toContain('qty');
  });
});

// prettier-ignore
const ROWS9 = [
  ['MOROFER SYP', 'VHL2606003', { year: 2027, month: 11 }, 40, 'MORAL PH', '1*300M'],
  ['CLAVAM BID DRY SYP', '2642275', { year: 2028, month: 5 }, 36, 'ALKEM MA', '1*30ML'],
  ['CLAVAM BID DRY SYP', '2641338', { year: 2028, month: 3 }, 18, 'ALKEM MA', '1*60ML'],
  ['CLAVAM BID DRY SYP', '2643648', { year: 2028, month: 8 }, 18, 'ALKEM MA', '1*60ML'],
  ['CLAVAM DRY SYP', '2642497', { year: 2028, month: 5 }, 36, 'ALKEM MA', '1*30ML'],
  ['CLAVAM 625 TAB', '26441959', { year: 2027, month: 10 }, 24, 'ALKEM MA', '1*10'],
  ['SUMO ACE TAB', '26230007', { year: 2028, month: 4 }, 20, 'ALKEM PL', '1*10'],
  ['NOWORM SUSP', '26490871', { year: 2028, month: 7 }, 25, 'ALKEM AL', '1*10ML'],
  ['SWICH 50MG DRY SYP', '26461024', { year: 2027, month: 11 }, 20, 'ALKEM NE', '1*30ML'],
];

describe('real distributor bill (Swastik layout)', () => {
  const strip = (r: ReturnType<typeof parseBillText>) => ({
    header: r.header,
    drafts: r.drafts.map(({ key: _key, ...d }) => d),
  });
  const real = parseBillText(realBillLines);

  it('reads the header: supplier is the top-left block, not the M/S buyer', () => {
    expect(real.header).toEqual({
      supplier: 'SWASTIK AGENCIES',
      billNo: '2185',
      billDate: '02/11/26',
    });
  });

  const rowsOf = (r: ReturnType<typeof parseBillText>) =>
    r.drafts.map((d) => [d.medicineName, d.batchNo, d.expiry, d.qty, d.companyName, d.packInfo]);

  it('parses all 9 rows from the columns', () => {
    expect(rowsOf(real)).toEqual(ROWS9);
  });

  it('parses all 9 rows with right-aligned numbers, labels left-aligned or centred', () => {
    expect(rowsOf(parseBillText(leftLabelBillLines))).toEqual(ROWS9);
    expect(rowsOf(parseBillText(centredRightBillLines))).toEqual(ROWS9);
  });

  it('flags expiry, batchNo and the truncated company on every row, nothing else', () => {
    for (const d of real.drafts) expect(d.uncertain).toEqual(['expiry', 'batchNo', 'companyName']);
  });

  it('takes the bill date, not the due date, whichever comes first', () => {
    const { header } = parseBillText([
      { text: 'SHOP', top: 0, left: 0 },
      { text: 'Due Date : 03/11/26 Date : 02/11/26', top: 30, left: 0 },
    ]);
    expect(header.billDate).toBe('02/11/26');
  });

  it('gives identical output for a skewed, sideways or upside-down photo', () => {
    for (const deg of [3, -3, 7, -7, 20, -20, 35, -35, 90, 180, 270])
      expect(strip(parseBillText(rotated(realBillLines, deg)))).toEqual(strip(real));
  });
});

describe('normalizeOrientation', () => {
  it('leaves upright lines and lines without corners alone', () => {
    expect(normalizeOrientation(realBillLines)).toEqual(realBillLines);
    const plain: OcrLine[] = [{ text: 'a', top: 1, left: 2 }];
    expect(normalizeOrientation(plain)).toEqual(plain);
  });

  it('ignores a skew under 0.3 degrees', () => {
    const tiny = rotated(realBillLines, 0.2);
    expect(normalizeOrientation(tiny)).toBe(tiny);
  });

  it('turns a sideways photo back into reading orientation', () => {
    const back = normalizeOrientation(rotated(realBillLines, 90));
    const dx = realBillLines[0].left - back[0].left;
    const dy = realBillLines[0].top - back[0].top;
    back.forEach((l, i) => {
      const o = realBillLines[i];
      expect([l.text, l.left + dx, l.top + dy, l.width, l.height]).toEqual([
        o.text,
        o.left,
        o.top,
        o.width,
        o.height,
      ]);
    });
  });
});
