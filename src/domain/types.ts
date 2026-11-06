export type YearMonth = { year: number; month: number }; // month 1-12
export type BatchStatus = 'expired' | 'soon' | 'watch' | 'ok';
export type AlertDays = { first: number; second: number };
export type Unit = 'carton' | 'box' | 'strip' | 'bottle' | 'tube' | 'can' | 'piece';

export type Shop = {
  id: string;
  name: string;
  alertDays: AlertDays;
  notifyTime: string;
  joinSecret: string;
};
export type Device = { id: string; displayName: string; joinedAt: number; removed: boolean };
export type Category = { id: string; name: string; order: number; lastCheckedAt: number | null };
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
};
