import { applyMatch, emptyDraft, type DraftBatch, type DraftField } from '@/domain/draft';
import { parseExpiry } from '@/domain/expiry';
import { normalizeName } from '@/domain/matching';
import { UNITS, type Company, type Medicine, type Unit } from '@/domain/types';

const WORDS = [
  'zero one two three four five six seven eight nine ten',
  'eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen',
]
  .join(' ')
  .split(' ');
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const FULL =
  'january february march april may june july august september october november december'.split(
    ' ',
  );

const isDigits = (t: string) => /^\d+$/.test(t);
const wordValue = (t: string): number | null => {
  const i = WORDS.indexOf(t);
  if (i >= 0) return i;
  const j = TENS.indexOf(t);
  return j >= 0 ? (j + 2) * 10 : null;
};
const isNum = (t: string) => isDigits(t) || wordValue(t) !== null || t === 'hundred';

function parseNumber(ts: string[]): number | null {
  if (!ts.length) return null;
  let total = 0;
  for (const t of ts) {
    if (isDigits(t)) total += Number(t);
    else if (t === 'hundred') total = (total || 1) * 100;
    else {
      const v = wordValue(t);
      if (v === null) return null;
      total += v;
    }
  }
  return total;
}

const unitOf = (t: string): Unit | null =>
  UNITS.find((u) => t === u || t === `${u}s` || t === `${u}es`) ?? null;

/** Reads "<month> <year>" at the start of ts; returns the YearMonth text and tokens used. */
function readExpiry(ts: string[]): { text: string; used: number } | null {
  let m: number | null = null;
  const i = MONTHS.indexOf(ts[0]?.slice(0, 3));
  if (i >= 0 && (ts[0].length === 3 || FULL[i] === ts[0])) m = i + 1;
  else if (ts[0] && isNum(ts[0]) && ts[0] !== 'hundred') m = wordValue(ts[0]) ?? Number(ts[0]);
  if (m === null || m < 1 || m > 12) return null;
  const y = ts[1];
  if (y && isDigits(y) && (y.length === 2 || y.length === 4)) return { text: `${m}/${y}`, used: 2 };
  const tens = y ? wordValue(y) : null;
  if (tens === null || tens < 20) return null;
  const ones = ts[2] ? wordValue(ts[2]) : null;
  const both = ones !== null && ones >= 1 && ones <= 9;
  return { text: `${m}/${tens + (both ? ones : 0)}`, used: both ? 3 : 2 };
}

/** Turns a spoken entry into one voice draft; batch and expiry are always left unconfirmed. */
export function parseVoiceEntry(
  transcript: string,
  medicines: Medicine[],
  companies: Company[],
): DraftBatch {
  const toks = transcript.replace(/[,]/g, ' , ').replace(/[.]/g, ' ').split(/\s+/).filter(Boolean);
  const low = toks.map((t) => t.toLowerCase());
  const at = (pred: (t: string) => boolean) => low.findIndex(pred);
  const bi = at((t) => t === 'batch');
  const ei = at((t) => ['expiry', 'expires', 'exp'].includes(t));

  // Trailing "<qty> <unit>".
  let end = toks.length;
  const unit = end && unitOf(low[end - 1]);
  if (unit) end--;

  let expiry = null;
  const expiryFirst = ei >= 0 && bi > ei;
  let qtyStart = end;
  let rest: string[] = [];
  if (ei >= 0) {
    rest = low.slice(ei + 1, expiryFirst ? bi : end).filter((t) => t !== ',');
    const r = readExpiry(rest);
    if (r) {
      expiry = parseExpiry(r.text);
      rest = rest.slice(r.used);
      if (!expiryFirst) qtyStart = end - rest.length;
    }
  }
  let qty: number | null = null;
  if (unit) {
    if (ei >= 0 && expiry && !expiryFirst) qty = parseNumber(rest);
    else {
      // shortcut: without a readable expiry only the last number (or tens+ones) is taken as qty.
      let s = end - 1;
      const ones = wordValue(low[s]);
      if (s > 0 && ones !== null && ones < 10 && (wordValue(low[s - 1]) ?? 0) >= 20) s--;
      qty = s >= 0 && isNum(low[s]) ? parseNumber(low.slice(s, end)) : null;
      if (qty !== null) qtyStart = s;
    }
  }

  const batchEnd = ei > bi ? ei : Math.min(qtyStart, end);
  const batchNo =
    bi < 0
      ? ''
      : low
          .slice(bi + 1, Math.max(bi + 1, batchEnd))
          .map((t) => (wordValue(t) !== null ? String(wordValue(t)) : t))
          .join('')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');

  const kw = [bi, ei].filter((i) => i >= 0);
  const headEnd = kw.length ? Math.min(...kw) : qtyStart;
  const head = toks.slice(0, headEnd);
  const comma = head.indexOf(',');
  const nameToks = comma >= 0 ? head.slice(0, comma) : head;

  const hay = ` ${normalizeName(transcript)} `;
  const known = companies
    .filter((c) => normalizeName(c.name) && hay.includes(` ${normalizeName(c.name)} `))
    .sort((a, b) => b.name.length - a.name.length)[0];
  let companyName = known?.name ?? '';
  if (known) {
    const k = normalizeName(known.name).split(' ').length;
    const tail = normalizeName(nameToks.slice(-k).join(' '));
    if (tail === normalizeName(known.name)) nameToks.length -= k;
  } else if (comma >= 0) {
    companyName = head
      .slice(comma + 1)
      .filter((t) => t !== ',')
      .join(' ');
  }

  const medicineName = nameToks.join(' ').trim();
  const uncertain: DraftField[] = ['batchNo', 'expiry'];
  if (qty === null) uncertain.push('qty');
  if (!medicineName) uncertain.push('medicineName');

  return applyMatch(
    {
      ...emptyDraft('voice'),
      medicineName,
      companyName,
      batchNo,
      expiry,
      qty,
      unit: unit || null,
      uncertain,
    },
    medicines,
    companies,
  );
}
