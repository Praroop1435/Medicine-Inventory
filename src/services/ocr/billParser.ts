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
const BILL_NO = /\b(bill|inv(oice)?)\.?\s*(no|#)?\.?\s*[.:]?\s*([A-Za-z0-9/-]*\d[A-Za-z0-9/-]*)/i;

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

type Head = { key: string; left: number; right: number };
const word = (t: string) => t.toLowerCase().replace(/[^a-z]/g, '');
const MONEY = /^\d+\.\d\d$/;
const right = (l: OcrLine) => l.left + (l.width ?? 0);
const isTableHeader = (r: OcrLine[]) => {
  const w = new Set(r.flatMap((l) => l.text.split(/\s+/).map(word)));
  return w.has('batch') && (w.has('exp') || w.has('expiry')) && w.has('qty');
};

/**
 * Groups a row's words into cells: a wide gap, crossing the start of a header label, or a money
 * amount ("205.00", often right-aligned one space before the next column) starts a new cell.
 */
function toCells(row: OcrLine[], heads: Head[], ch: number): OcrLine[][] {
  const cells: OcrLine[][] = [];
  row.forEach((l, i) => {
    const p = row[i - 1];
    const crosses = p && heads.some((h) => p.left < h.left - ch / 2 && l.left >= h.left - ch / 2);
    const money = p && (MONEY.test(p.text.trim()) || MONEY.test(l.text.trim()));
    if (!p || crosses || money || l.left - right(p) > 1.5 * ch) cells.push([l]);
    else cells[cells.length - 1].push(l);
  });
  return cells;
}

/** One table row read column by column: each cell goes to the header label it overlaps most. */
function parseColumnRow(row: OcrLine[], heads: Head[], ch: number): DraftBatch | null {
  const cells = new Map<string, string[]>();
  for (const c of toCells(row, heads, ch)) {
    const [l, r] = [c[0].left, Math.max(...c.map(right))];
    // overlap with the label; negative = distance to it, so no overlap falls back to the nearest
    const ov = (h: Head) => Math.min(r, h.right) - Math.max(l, h.left);
    const key = heads.reduce((a, b) => (ov(b) > ov(a) ? b : a)).key;
    cells.set(key, [...(cells.get(key) ?? []), ...c.flatMap((w) => w.text.trim().split(/\s+/))]);
  }
  const cell = (...keys: string[]) => keys.flatMap((k) => cells.get(k) ?? []);
  const batch = cell('batch').find((t) => /^[A-Za-z0-9-]+$/.test(t) && /\d/.test(t));
  const exp = cell('exp', 'expiry').find((t) => parseExpiry(t) || EXPIRY_SHAPED.test(t));
  if (!batch && !exp) return null;
  const d = emptyDraft('scan');
  d.medicineName = cell('product', 'item').join(' ').replace(/\.+$/, '');
  d.batchNo = batch?.toUpperCase() ?? '';
  d.expiry = exp ? parseExpiry(exp) : null;
  const qt = cell('qty');
  const ft = cell('free');
  const joined = qt.join('');
  // OCR can split "20+20" into "20 + 20": rejoin only around a "+", and always flag a split cell
  const q = qt.length === 1 || joined.includes('+') ? qtyFromToken(joined) : null;
  const freeOk = !ft.length || (ft.length === 1 && /^\d+$/.test(ft[0]));
  d.qty = q === null ? null : q + (freeOk ? Number(ft[0] ?? 0) : 0);
  d.companyName = cell('mfg').join(' ');
  const pack = cell('pack').find((t) => /\d/.test(t)); // skips handwritten tick marks
  if (pack) d.packInfo = pack;
  d.uncertain.push('expiry', 'batchNo');
  // MFG cells are truncated division codes ("ALKEM MA"): the user confirms or a match replaces it.
  if (d.companyName) d.uncertain.push('companyName');
  if (!d.medicineName) d.uncertain.push('medicineName');
  if (d.qty === null || qt.length > 1 || !freeOk) d.uncertain.push('qty');
  return d;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// exact for quarter turns, so a sideways photo maps back to the same integer coordinates
const snap = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v);

/**
 * Turns the lines of a skewed, sideways or upside-down photo into reading orientation, by the
 * median text direction of their corner points. Lines without corners, or a skew under 0.3°, pass.
 */
export function normalizeOrientation(lines: OcrLine[]): OcrLine[] {
  const angles = lines.flatMap(({ corners: c }) =>
    c && c.length > 1 ? [Math.atan2(c[1].y - c[0].y, c[1].x - c[0].x)] : [],
  );
  if (!angles.length) return lines;
  const rough = median(angles); // then a median of deviations, so ±180° readings don't split
  const a = wrap(rough + median(angles.map((x) => wrap(x - rough))));
  if (Math.abs(a) < (0.3 * Math.PI) / 180) return lines;
  const [cos, sin] = [snap(Math.cos(a)), snap(Math.sin(a))];
  return lines.map((l) => {
    const { left: x, top: y, width: w = 0, height: h = 0 } = l;
    const box = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    const pts = (l.corners ?? box).map((p) => ({
      x: p.x * cos + p.y * sin,
      y: p.y * cos - p.x * sin,
    }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return {
      ...l,
      left,
      top,
      width: Math.max(...xs) - left,
      height: Math.max(...ys) - top,
      ...(l.corners ? { corners: pts } : {}),
    };
  });
}

const DUE_DATE = /due\s*date\s*[.:]?\s*\S+/gi;
const DATE_LABEL = /\bdate\s*[.:]?\s*(\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4}))\b/i;
const FOOTER = /^(message|total|sub ?total|cgst|sgst|igst|gst|round|net|amount|grand)/i;

export function parseBillText(lines: OcrLine[]): {
  header: Partial<BillHeader>;
  drafts: DraftBatch[];
} {
  const all = normalizeOrientation(lines.filter((l) => l.text.trim()));
  const rows = toRows(all);
  const texts = rows.map((r) => r.map((l) => l.text.trim()).join(' '));
  const headIdx = rows.findIndex(isTableHeader);
  const header: Partial<BillHeader> = {};

  // Supplier: the top-left block. The right block ("M/S <shop>") is the buyer.
  const mid = (Math.min(...all.map((l) => l.left)) + Math.max(...all.map(right))) / 2;
  const supplier = rows
    .slice(0, headIdx >= 0 ? headIdx : rows.length)
    .map((r) =>
      r
        .filter((l) => (l.left + right(l)) / 2 < mid)
        .map((l) => l.text.trim())
        .join(' '),
    )
    .find((t) => /[a-z]/i.test(t) && !/^m\/s\b/i.test(t) && !/invoice/i.test(t));
  if (supplier) header.supplier = supplier.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  const billNo = texts.map((t) => BILL_NO.exec(t)?.[4]).find(Boolean);
  if (billNo) header.billNo = billNo;
  const dated = texts.map((t) => t.replace(DUE_DATE, ''));
  const tops = rows.map((r) => r[0].top);
  const cutoff = tops[0] + (tops[tops.length - 1] - tops[0]) * 0.25;
  const date =
    dated.map((t) => DATE_LABEL.exec(t)?.[1]).find(Boolean) ??
    dated.map((t, i) => (tops[i] <= cutoff ? DATE.exec(t)?.[0] : undefined)).find(Boolean);
  if (date) header.billDate = date;

  const drafts: DraftBatch[] = [];
  if (headIdx >= 0) {
    const heads = rows[headIdx].map((l) => ({ key: word(l.text), left: l.left, right: right(l) }));
    const chars = all.flatMap((l) => (l.width ? [l.width / l.text.trim().length] : []));
    const ch = chars.length ? median(chars) : 0;
    for (const row of rows.slice(headIdx + 1)) {
      if (FOOTER.test(row.map((l) => l.text.trim()).join(' '))) break; // table ends at the footer
      const d = parseColumnRow(row, heads, ch);
      if (d) drafts.push(d);
    }
    return { header, drafts };
  }

  // No table header found: fall back to token heuristics.
  const heights = all.flatMap((l) => (l.height ? [l.height] : []));
  const tol = heights.length ? median(heights) * 1.5 : 25;
  const colOf = (re: RegExp) => all.find((l) => re.test(l.text.trim()))?.left;
  const cols: Cols = {
    batch: colOf(/^batch\b/i),
    qty: colOf(/^qty\.?$/i),
    free: colOf(/^free$/i),
    tol,
  };
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
