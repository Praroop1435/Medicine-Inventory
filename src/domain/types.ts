export type YearMonth = { year: number; month: number }; // month 1-12
export type BatchStatus = 'expired' | 'soon' | 'watch' | 'ok';
export type AlertDays = { first: number; second: number };
/** Any text: shops add their own. New shops start from this list. */
export type Unit = string;
export const DEFAULT_UNITS: readonly string[] = [
  'strip',
  'tablet',
  'capsule',
  'bottle',
  'carton',
  'box',
  'tube',
  'can',
  'piece',
  'sachet',
  'vial',
  'ampoule',
  'jar',
  'inhaler',
  'drops',
  'packet',
];

export type Shop = {
  id: string;
  name: string;
  alertDays: AlertDays;
  notifyTime: string;
  /** Night stock reminder, "HH:MM". Missing on shops made before it; read with a default. */
  nightTime?: string;
  joinSecret: string;
  /** Missing on shops made before custom units; read through shopUnits(). */
  units?: string[];
};
export type Device = { id: string; displayName: string; joinedAt: number; removed: boolean };
export type Category = {
  id: string;
  name: string;
  order: number;
  lastCheckedAt: number | null;
  /** null = top level. A folder holds sub-folders and medicines at once (§11.1). */
  parentId: string | null;
};
export type Company = { id: string; name: string };
export type Medicine = {
  id: string;
  name: string;
  categoryId: string;
  companyId: string;
  unit: Unit;
  composition?: string;
  packInfo?: string;
};
export type Batch = {
  id: string;
  medicineId: string;
  batchNo: string;
  expiry: YearMonth;
  qty: number;
  billId: string | null;
  status: 'active' | 'returned' | 'removed';
  createdAt: number;
};
export type Bill = {
  id: string;
  supplier: string;
  billNo: string;
  billDate: string;
  scannedBy: string;
  createdAt: number;
};
export type StockEvent = {
  id: string;
  batchId: string;
  medicineId: string;
  type: 'added' | 'sold' | 'count_fixed' | 'checked' | 'returned' | 'removed' | 'edited';
  delta: number;
  deviceId: string;
  at: number;
  /** On `added` events: the bill that brought the stock in, if any. */
  billId?: string | null;
};

export const DEFAULT_NIGHT_TIME = '21:00';
export const shopNightTime = (shop: Shop): string => shop.nightTime ?? DEFAULT_NIGHT_TIME;

export const shopUnits = (shop: Shop | null): readonly string[] =>
  shop?.units?.length ? shop.units : DEFAULT_UNITS;

/** Trimmed lowercase unit, or throws when blank or over 24 characters. */
export function cleanUnit(raw: string): string {
  const u = raw.trim().toLowerCase();
  if (!u || u.length > 24) throw new Error('Unit must be 1 to 24 characters');
  return u;
}
