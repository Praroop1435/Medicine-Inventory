import { batchStatus, daysUntilExpiry, expiryDate, formatExpiry, parseExpiry } from '../expiry';

const today = new Date(2026, 10, 6);
const alert = { first: 90, second: 30 };
const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe('expiryDate', () => {
  it('is last day of month', () => {
    expect(ymd(expiryDate({ year: 2026, month: 11 }))).toEqual([2026, 11, 30]);
    expect(ymd(expiryDate({ year: 2028, month: 2 }))).toEqual([2028, 2, 29]);
  });
});

describe('daysUntilExpiry', () => {
  it('counts calendar days', () => {
    expect(daysUntilExpiry({ year: 2026, month: 11 }, today)).toBe(24);
    expect(daysUntilExpiry({ year: 2026, month: 10 }, today)).toBeLessThan(0);
    expect(daysUntilExpiry({ year: 2027, month: 1 }, new Date(2026, 11, 31))).toBe(31);
  });
});

describe('batchStatus', () => {
  const st = (ym: { year: number; month: number }, t = today) => batchStatus(ym, t, alert);
  it('classifies by month', () => {
    expect(st({ year: 2026, month: 10 })).toBe('expired');
    expect(st({ year: 2026, month: 11 })).toBe('soon');
    expect(st({ year: 2027, month: 1 })).toBe('watch');
    expect(st({ year: 2027, month: 8 })).toBe('ok');
  });
  it('boundaries', () => {
    const ym = { year: 2026, month: 11 }; // expires 30 Nov
    expect(st(ym, new Date(2026, 10, 30))).toBe('soon'); // 0 days
    expect(st(ym, new Date(2026, 9, 31))).toBe('soon'); // 30 days
    expect(st(ym, new Date(2026, 9, 30))).toBe('watch'); // 31 days
    expect(st(ym, new Date(2026, 8, 1))).toBe('watch'); // 90 days
    expect(st(ym, new Date(2026, 7, 31))).toBe('ok'); // 91 days
  });
});

describe('parseExpiry', () => {
  it.each(['11/26', '11/2026', '11-26', 'NOV-26', 'Nov 2026', 'november 2026', '2026-11'])(
    'parses %s',
    (s) => expect(parseExpiry(s)).toEqual({ year: 2026, month: 11 }),
  );
  it.each(['1126', '13/26', '00/26', '', 'abc', '11/0026', '0026-11', '11/0000', '2026-13', '11/226', 'sept 26'])('rejects %s', (s) =>
    expect(parseExpiry(s)).toBeNull(),
  );
});

describe('formatExpiry', () => {
  it('formats', () => expect(formatExpiry({ year: 2027, month: 8 })).toBe('Aug 2027'));
});
