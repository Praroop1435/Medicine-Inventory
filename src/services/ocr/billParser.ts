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

type Tok = { t: string; left: number };
type Cols = { batch?: number; qty?: number; free?: number; tol: number };

const under = (k: Tok, col: number | undefined, tol: number) =>
  col !== undefined && Math.abs(k.left - col) <= tol;

function parseRow(toks: Tok[], cols: Cols): DraftBatch | null {
  const tokens = toks.map((k) => k.t);
  const colBatch = toks.findIndex(
    (k) =>
      under(k, cols.batch, cols.tol) &&
      /^[A-Za-z0-9-]+$/.test(k.t) &&
      /\d/.test(k.t) &&
      !parseExpiry(k.t),
  );
  const batchIdx = colBatch >= 0 ? colBatch : tokens.findIndex(isBatch);
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

  // qty: never fall back to a rate/MRP integer. Columns decide when headers were found;
  // otherwise the token right after the expiry is the qty, and several integers is ambiguous.
  const start = Math.max(expIdx, batchIdx) + 1;
  const after = toks.slice(start);
  let ambiguous = false;
  let q: number | null;
  if (cols.qty !== undefined) {
    const k = after.find((x) => under(x, cols.qty, cols.tol));
    q = k ? qtyFromToken(k.t) : null;
  } else {
    q = after[0] ? qtyFromToken(after[0].t) : null;
    ambiguous = true; // no Qty column: the value is a best guess (could be a rate), always confirm
  }
  if (q !== null && cols.free !== undefined) {
    const f = after.find((x) => under(x, cols.free, cols.tol) && /^\d+$/.test(x.t));
    q += f ? Number(f.t) : 0;
  }
  d.qty = q;
  // ML Kit gives no confidence: expiry and batch are always for the user to confirm.
  d.uncertain.push('expiry', 'batchNo');
  if (!d.medicineName) d.uncertain.push('medicineName');
  if (d.qty === null || ambiguous) d.uncertain.push('qty');
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

  const heights = lines.flatMap((l) => (l.height ? [l.height] : []));
  const tol = heights.length ? median(heights) * 1.5 : 25;
  const colOf = (re: RegExp) => lines.find((l) => re.test(l.text.trim()))?.left;
  const cols: Cols = {
    batch: colOf(/^batch\b/i),
    qty: colOf(/^qty\.?$/i),
    free: colOf(/^free$/i),
    tol,
  };
  const drafts: DraftBatch[] = [];
  texts.forEach((text, i) => {
    if (i === 0 || SKIP_ROW.test(text) || HEADER_ROW.test(text)) return;
    const toks = rows[i].flatMap((l) =>
      l.text
        .trim()
        .split(/\s+/)
        .map((t) => ({ t, left: l.left })),
    );
    const d = parseRow(toks, cols);
    if (d) drafts.push(d);
  });
  return { header, drafts };
}
