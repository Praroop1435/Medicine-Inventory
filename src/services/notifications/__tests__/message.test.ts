import type { Category } from '@/domain/types';
import { dailyMessage, dueCategory, nightReminder } from '../message';

const D = { first: 90, second: 30 };

describe('dailyMessage', () => {
  it('names expired and the nearest window', () => {
    expect(dailyMessage({ expired: 3, soon: 5, watch: 14 }, D)).toBe(
      '3 expired · 5 expire within 30 days',
    );
    expect(dailyMessage({ expired: 0, soon: 0, watch: 4 }, D)).toBe('4 expire within 90 days');
    expect(dailyMessage({ expired: 2, soon: 0, watch: 4 }, D)).toBe(
      '2 expired · 4 expire within 90 days',
    );
    expect(dailyMessage({ expired: 0, soon: 1, watch: 0 }, D)).toBe('1 expires within 30 days');
  });

  it('is null when there is nothing to report', () => {
    expect(dailyMessage({ expired: 0, soon: 0, watch: 0 }, D)).toBeNull();
  });
});

const DAY = 86_400_000;
const TODAY = new Date(2026, 10, 6);
const cat = (
  id: string,
  name: string,
  lastCheckedAt: number | null,
  parentId: string | null = null,
  order = 0,
): Category => ({
  id,
  name,
  order,
  lastCheckedAt,
  parentId,
});

describe('nightReminder', () => {
  const START = "Time for tonight's stock update — mark what was sold today.";

  it('names the top-level folder checked least recently', () => {
    const cats = [
      cat('a', 'Pain relief', TODAY.getTime() - 2 * DAY, null, 0),
      cat('b', 'Antibiotics', TODAY.getTime() - 18 * DAY + 3_600_000, null, 1),
      cat('c', 'Old sub-folder', TODAY.getTime() - 99 * DAY, 'b'),
    ];
    expect(nightReminder(cats, TODAY)).toBe(`${START} Due: Antibiotics (not checked for 18 days).`);
    expect(dueCategory(cats)?.id).toBe('b');
  });

  it('puts never-checked folders first', () => {
    const cats = [
      cat('a', 'Pain relief', TODAY.getTime() - 40 * DAY),
      cat('b', 'Balms', null, null, 1),
    ];
    expect(nightReminder(cats, TODAY)).toBe(`${START} Due: Balms (never checked).`);
  });

  it('handles one day, today, and no folders', () => {
    expect(nightReminder([cat('a', 'Balms', TODAY.getTime() - DAY)], TODAY)).toBe(
      `${START} Due: Balms (not checked for 1 day).`,
    );
    expect(nightReminder([cat('a', 'Balms', TODAY.getTime() + 3_600_000)], TODAY)).toBe(
      `${START} Due: Balms (checked today).`,
    );
    expect(nightReminder([], TODAY)).toBe(START);
    expect(dueCategory([])).toBeUndefined();
  });
});
