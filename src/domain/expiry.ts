import type { AlertDays, BatchStatus, YearMonth } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FULL = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

// Last day of the month, local time.
export const expiryDate = ({ year, month }: YearMonth): Date => new Date(year, month, 0);

// Calendar-day difference via UTC of the local Y/M/D, so DST never skews it.
export function daysUntilExpiry(ym: YearMonth, today: Date): number {
  const e = expiryDate(ym);
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(e) - utc(today)) / 86400000);
}

export function batchStatus(ym: YearMonth, today: Date, alertDays: AlertDays): BatchStatus {
  const d = daysUntilExpiry(ym, today);
  if (d < 0) return 'expired';
  if (d <= alertDays.second) return 'soon';
  if (d <= alertDays.first) return 'watch';
  return 'ok';
}

/** Why a read expiry needs a second look: already past, or more than 5 years ahead. */
export function expiryDoubt(ym: YearMonth, today: Date): 'expired' | 'far' | null {
  if (daysUntilExpiry(ym, today) < 0) return 'expired';
  const months = ym.year * 12 + ym.month - (today.getFullYear() * 12 + today.getMonth() + 1);
  return months > 60 ? 'far' : null;
}

const toYear = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s));
const valid = (year: number, month: number): YearMonth | null =>
  month >= 1 && month <= 12 && year >= 2000 && year <= 2099 ? { year, month } : null;

// `today` is unused: two-digit years always map to 20YY.
export function parseExpiry(text: string, _today?: Date): YearMonth | null {
  const t = text.trim().toLowerCase();
  let m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m) return valid(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})[/-](\d{2}|\d{4})$/.exec(t);
  if (m) return valid(toYear(m[2]), Number(m[1]));
  m = /^([a-z]{3,9})[\s/-]+(\d{2}|\d{4})$/.exec(t);
  if (m) {
    const i = m[1].length === 3 ? MONTHS.indexOf(m[1]) : FULL.indexOf(m[1]);
    return i < 0 ? null : valid(toYear(m[2]), i + 1);
  }
  return null;
}

export const formatExpiry = ({ year, month }: YearMonth): string =>
  `${MONTHS[month - 1][0].toUpperCase()}${MONTHS[month - 1].slice(1)} ${year}`;
