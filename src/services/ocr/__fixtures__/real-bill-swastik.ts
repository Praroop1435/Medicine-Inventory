import type { OcrLine } from '../OcrEngine';

// Layout of the shop's real distributor bill (transcribed 2026-11-06), one OcrLine per word as
// ML Kit elements arrive. Phone, DL, GST, email, bank and buyer details are dummy values.
const CH = 10; // px per character
const H = 20; // word height

/** Words of `text` starting at x, each with its upright corner points (TL, TR, BR, BL). */
function words(text: string, x: number, y: number): OcrLine[] {
  const out: OcrLine[] = [];
  for (const w of text.split(' ')) {
    const width = w.length * CH;
    out.push({
      text: w,
      left: x,
      top: y,
      width,
      height: H,
      corners: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + H },
        { x, y: y + H },
      ],
    });
    x += width + CH;
  }
  return out;
}

// Column start x and width (chars). Header labels are centred over their column, values left-aligned.
const COLS: [string, number, number][] = [
  ['S.N', 20, 4],
  ['HSN.', 70, 6],
  ['Pack', 140, 8],
  ['Product', 240, 20],
  ['Batch', 470, 11],
  ['Exp', 600, 5],
  ['QTY', 670, 6],
  ['MRP', 750, 7],
  ['RATE', 830, 7],
  ['Dis', 910, 5],
  ['MFG', 970, 9],
  ['GST', 1080, 5],
  ['Amount', 1140, 8],
];

// prettier-ignore
const ROWS = [
  ['1', '3004', '1*300M', 'MOROFER SYP', 'VHL2606003', '11/27', '20+20', '205.00', '156.19', '0.00', 'MORAL PH', '5.00', '3123.80'],
  ['2', '3004', '1*30ML', 'CLAVAM BID DRY SYP', '2642275', '05/28', '30+6', '65.10', '49.60', '0.00', 'ALKEM MA', '5.00', '1488.00'],
  ['3', '3004', '1*60ML', 'CLAVAM BID DRY SYP.', '2641338', '03/28', '15+3', '114.23', '87.03', '0.00', 'ALKEM MA', '5.00', '1305.45'],
  ['4', '3004', '1*60ML', 'CLAVAM BID DRY SYP.', '2643648', '08/28', '15+3', '114.23', '87.03', '0.00', 'ALKEM MA', '5.00', '1305.45'],
  ['5', '3004', '1*30ML', 'CLAVAM DRY SYP', '2642497', '05/28', '30+6', '66.15', '50.40', '0.00', 'ALKEM MA', '5.00', '1512.00'],
  ['6', '3004', '1*10', 'CLAVAM 625 TAB.', '26441959', '10/27', '20+4', '196.73', '149.89', '0.00', 'ALKEM MA', '5.00', '2997.80'],
  ['7', '3004', '1*10', 'SUMO ACE TAB', '26230007', '04/28', '18+2', '130.95', '99.78', '0.00', 'ALKEM PL', '5.00', '1796.04'],
  ['8', '3004', '1*10ML', 'NOWORM SUSP.', '26490871', '07/28', '25', '19.22', '14.64', '0.00', 'ALKEM AL', '5.00', '366.00'],
  ['9', '3004', '1*30ML', 'SWICH 50MG DRY SYP', '26461024', '11/27', '18+2', '129.35', '98.55', '0.00', 'ALKEM NE', '5.00', '1773.90'],
];

const tableHeader = COLS.flatMap(([label, x, w]) =>
  words(label, x + ((w - label.length) * CH) / 2, 210),
);
const tableRows = ROWS.flatMap((cells, r) =>
  cells.flatMap((cell, c) => words(cell, COLS[c][1], 240 + r * 25)),
);

const at = (y: number, ...cells: [number, string][]) => cells.flatMap(([x, t]) => words(t, x, y));

export const realBillLines: OcrLine[] = [
  ...at(20, [20, '## SWASTIK AGENCIES ##'], [800, 'M/S SAMPLE MEDICAL.']),
  ...at(45, [20, 'PHARMACEUTICALS & DISTRIBUTORS'], [800, '1 SAMPLE ROAD SAMPLE TOWN']),
  ...at(70, [20, '12 SAMPLE MARKET, SAMPLE CITY'], [520, 'GST INVOICE']),
  ...at(95, [20, 'Phone : 9000000000'], [800, 'Inv. No : 2185']),
  ...at(
    120,
    [20, 'DL NO. : XX-00-000000'],
    [800, 'Date : 02/11/26'],
    [1000, 'Due Date : 03/11/26'],
  ),
  ...at(145, [20, 'EMAIL : sample@example.com'], [1000, 'SCAN FOR ONLINE PAYMENT']),
  ...at(170, [20, 'GST NO. : 00AAAAA0000A0Z0']),
  ...tableHeader,
  ...tableRows,
  ...at(480, [20, 'Message :']),
  ...at(505, [20, 'CLASS TOTAL CGST SGST TOTAL GST DISCOUNT SCHEME'], [800, 'BANK DETAIL :-']),
  ...at(530, [20, 'GST 0% 0.00 0.00 0.00 0.00 0.00 0.00'], [800, 'BANK : SAMPLE BANK']),
  ...at(555, [20, 'GST 5% 15668.44 391.71 391.71 783.42 0.00 0.00'], [800, 'A/C : 000000000000']),
  ...at(580, [20, 'GST 12% 0.00 0.00 0.00 0.00 0.00 0.00'], [800, 'IFSC : SMPL0000000']),
  ...at(605, [20, 'GST 18% 0.00 0.00 0.00 0.00 0.00 0.00'], [800, 'BRANCH : SAMPLE']),
  ...at(630, [20, 'GST 28% 0.00 0.00 0.00 0.00 0.00 0.00'], [1000, 'TOTAL 15668.44']),
  ...at(655, [20, 'TOTAL 15668.44 391.71 391.71 783.42 0.00 0.00'], [1000, 'Discount 0.00']),
  ...at(680, [1000, 'SGST 391.71']),
  ...at(705, [1000, 'CGST PAYBLE 391.71']),
  ...at(730, [1000, 'CR/DR NOTE 0.00']),
  ...at(755, [1000, 'R/Off 0.14']),
  ...at(780, [1000, 'G.Total : 16452.0']),
  ...at(805, [20, 'Goods once sold will not be taken back']),
  ...at(830, [20, 'RS.[RUPEES SIXTEEN THOUSAND FOUR HUNDRED FIFTY TWO ONLY]']),
  ...at(855, [1000, 'Authorised signatory']),
];

/** The same photo turned by `deg` (90, 180, 270): corners rotate, the frame is their bounding box. */
export function rotated(lines: OcrLine[], deg: 90 | 180 | 270): OcrLine[] {
  const turn = ({ x, y }: { x: number; y: number }) =>
    deg === 90
      ? { x: 2000 - y, y: x }
      : deg === 180
        ? { x: 2000 - x, y: 2000 - y }
        : { x: y, y: 2000 - x };
  return lines.map((l) => {
    const corners = (l.corners ?? []).map(turn);
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return {
      text: l.text,
      left,
      top,
      width: Math.max(...xs) - left,
      height: Math.max(...ys) - top,
      corners,
    };
  });
}
