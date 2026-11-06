import { emptyDraft, type DraftBatch } from '@/domain/draft';
import { parseExpiry } from '@/domain/expiry';
import type { BillHeader } from '@/features/intake/IntakeContext';
import type { OcrLine } from './OcrEngine';

const SKIP_ROW = /^(total|sub ?total|cgst|sgst|igst|gst|round|net|amount|grand)/i;
const HEADER_ROW = /^(bill|inv|invoice|date|gstin|dl|d\.l|phone|ph|mob|product|item)\b/i;
const STRENGTH = /^\d+(\.\d+)?(mg|mcg|ml|gm|g|iu|%)$/i;
const PACK = /^(\d+[x*]\d+|\d+('?s|tab|tabs|cap|caps))$/i;
const EXPIRY_SHAPED = /^\d{1,2}[/-]\w{1,4}$/; // looks like an expiry even if unreadable ("1/2X")
const DATE = /\b\d{1,2}[/-]\d{1,2}[/-](\d{2}|\d{4})\b/;
const BILL_NO = /\b(bill|inv(oice)?)\s*(no|#)?[.:]?\s*([A-Za-z0-9/-]*\d[A-Za-z0-9/-]*)/i;

export function qtyFromToken(t: string): number | null {
  const m = /^(\d+)(?:\+(\d+))?$/.exec(t.trim());
  return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function toRows(lines: OcrLine[]): OcrLine[][] {
  const heights = lines.flatMap((l) => (l.height ? [l.height] : []));
  const tol = heights.length ? median(heights) / 2 : 8;
  const rows: OcrLine[][] = [];
  for (const l of [...lines].sort((a, b) => a.top - b.top)) {
    const row = rows.find((r) => Math.abs(r[0].top - l.top) <= tol);
    if (row) row.push(l);
    else rows.push([l]);
  }
  return rows.map((r) => r.sort((a, b) => a.left - b.left));
}

const isBatch = (t: string) =>
  /^[A-Za-z0-9-]+$/.test(t) &&
  /[A-Za-z]/.test(t) &&
  /\d/.test(t) &&
  !parseExpiry(t) &&
  !STRENGTH.test(t) &&
  !PACK.test(t);

function parseRow(tokens: string[], hasFree: boolean): DraftBatch | null {
  const batchIdx = tokens.findIndex(isBatch);
  const expIdx = tokens.findIndex((t) => parseExpiry(t) || EXPIRY_SHAPED.test(t));
  if (batchIdx < 0 && expIdx < 0) return null;
  const d = emptyDraft('scan');
  const nameEnd = [batchIdx, expIdx].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b));
  d.medicineName = tokens
    .slice(0, nameEnd)
    .filter((t) => !PACK.test(t))
    .join(' ');
  d.batchNo = batchIdx >= 0 ? tokens[batchIdx].toUpperCase() : '';
  d.expiry = expIdx >= 0 ? parseExpiry(tokens[expIdx]) : null;
  const nums = tokens.slice(Math.max(expIdx, batchIdx) + 1).filter((t) => qtyFromToken(t) !== null);
  if (nums.length)
    d.qty = (qtyFromToken(nums[0]) ?? 0) + (hasFree && nums[1] ? (qtyFromToken(nums[1]) ?? 0) : 0);
  if (!d.medicineName) d.uncertain.push('medicineName');
  if (!d.batchNo) d.uncertain.push('batchNo');
  if (!d.expiry) d.uncertain.push('expiry');
  if (d.qty === null) d.uncertain.push('qty');
  return d;
}

export function parseBillText(lines: OcrLine[]): {
  header: Partial<BillHeader>;
  drafts: DraftBatch[];
} {
  const rows = toRows(lines.filter((l) => l.text.trim()));
  const texts = rows.map((r) => r.map((l) => l.text.trim()).join(' '));
  const header: Partial<BillHeader> = {};
  if (texts[0]) header.supplier = texts[0];
  const billNo = texts.map((t) => BILL_NO.exec(t)?.[4]).find(Boolean);
  if (billNo) header.billNo = billNo;
  const tops = rows.map((r) => r[0].top);
  const cutoff = tops[0] + (tops[tops.length - 1] - tops[0]) * 0.25;
  const date = texts.find((t, i) => tops[i] <= cutoff && DATE.test(t));
  if (date) header.billDate = DATE.exec(date)![0];

  const hasFree = lines.some((l) => /^free$/i.test(l.text.trim()));
  const drafts: DraftBatch[] = [];
  texts.forEach((text, i) => {
    if (i === 0 || SKIP_ROW.test(text) || HEADER_ROW.test(text)) return;
    const d = parseRow(text.split(/\s+/), hasFree);
    if (d) drafts.push(d);
  });
  return { header, drafts };
}
