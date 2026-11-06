import type { Category } from '@/domain/types';
import { parseSheetRows } from '../sheetParser';

const cats: Category[] = [{ id: 'c1', name: 'Antibiotics', order: 0, lastCheckedAt: null }];
const H = ['category', 'company', 'medicine', 'unit', 'batch', 'expiry', 'qty'];

describe('parseSheetRows', () => {
  it('parses a good row; headers case-insensitive, any order', () => {
    const rows = [
      ['QTY', 'Batch', 'MEDICINE', 'Unit', 'Company', 'Expiry', 'Category'],
      ['10+1', ' AZ88 ', ' Azithral 500 ', 'Cartons', ' Alembic ', '11/26', 'antibiotics'],
    ];
    const { drafts, errors } = parseSheetRows(rows, cats);
    expect(errors).toEqual([]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      source: 'bulk',
      medicineName: 'Azithral 500',
      companyName: 'Alembic',
      batchNo: 'AZ88',
      unit: 'carton',
      qty: 11,
      categoryId: 'c1',
      expiry: { year: 2026, month: 11 },
      uncertain: [],
    });
  });

  it('reports a missing column once', () => {
    const { drafts, errors } = parseSheetRows([H.filter((h) => h !== 'batch'), ['a']], cats);
    expect(drafts).toEqual([]);
    expect(errors).toEqual([{ row: 1, message: 'Missing column: batch' }]);
  });

  it('flags bad expiry with the spreadsheet row number', () => {
    const { drafts, errors } = parseSheetRows(
      [
        H,
        ['', 'A', 'Good', 'box', 'B1', '11/26', '1'],
        ['', 'A', 'Bad', 'box', 'B2', '13/26', '1'],
      ],
      cats,
    );
    expect(drafts).toHaveLength(1);
    expect(errors).toEqual([{ row: 3, message: 'Expiry not readable' }]);
  });

  it('flags unknown unit, bad qty, blank medicine/batch; skips blank rows', () => {
    const { drafts, errors } = parseSheetRows(
      [
        H,
        ['', 'A', 'M', 'sack', 'B', '11/26', '1'],
        ['', 'A', 'M', 'box', 'B', '11/26', '0'],
        ['', 'A', 'M', 'box', 'B', '11/26', '1.5'],
        ['', 'A', '', 'box', 'B', '11/26', '1'],
        ['', 'A', 'M', 'box', '', '11/26', '1'],
        ['', '', '', '', '', '', ''],
      ],
      cats,
    );
    expect(drafts).toEqual([]);
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6]);
  });

  it('gives categoryId null for an unknown category', () => {
    const { drafts } = parseSheetRows(
      [H, ['Vitamins', 'A', 'M', 'strip', 'B', '11/26', '2']],
      cats,
    );
    expect(drafts[0].categoryId).toBeNull();
  });
});
