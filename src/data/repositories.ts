import type { DraftBatch } from '@/domain/draft';
import type {
  Batch,
  Bill,
  Category,
  Company,
  Device,
  Medicine,
  Shop,
  StockEvent,
} from '@/domain/types';

export type Unsub = () => void;

export interface ShopRepo {
  createShop(
    name: string,
    displayName: string,
  ): Promise<{ shopId: string; joinSecret: string; deviceId: string }>;
  joinShop(shopId: string, joinSecret: string, displayName: string): Promise<{ deviceId: string }>;
  watchShop(shopId: string, cb: (s: Shop) => void): Unsub;
  updateShop(
    shopId: string,
    patch: Partial<Pick<Shop, 'name' | 'alertDays' | 'notifyTime'>>,
    deviceId: string,
  ): Promise<void>;
  watchDevices(shopId: string, cb: (d: Device[]) => void): Unsub;
  renameDevice(shopId: string, deviceId: string, name: string): Promise<void>;
  removeDevice(shopId: string, deviceId: string, byDeviceId: string): Promise<void>;
  rotateJoinSecret(shopId: string, byDeviceId: string): Promise<string>;
}

export type SyncState = { online: boolean; pending: number };

export interface InventoryRepo {
  watchSyncState(shopId: string, cb: (s: SyncState) => void): Unsub;
  watchCategories(shopId: string, cb: (c: Category[]) => void): Unsub;
  watchCompanies(shopId: string, cb: (c: Company[]) => void): Unsub;
  watchMedicines(shopId: string, cb: (m: Medicine[]) => void): Unsub;
  watchLiveBatches(shopId: string, cb: (b: Batch[]) => void): Unsub; // status == 'active'
  watchMedicineEvents(
    shopId: string,
    medicineId: string,
    limit: number,
    cb: (e: StockEvent[]) => void,
  ): Unsub;
  saveIntake(
    shopId: string,
    drafts: DraftBatch[],
    bill: Omit<Bill, 'id' | 'createdAt'> | null,
    deviceId: string,
  ): Promise<void>;
  sellOne(shopId: string, batchId: string, deviceId: string): Promise<void>;
  setCount(
    shopId: string,
    batchId: string,
    qty: number,
    deviceId: string,
    type: 'count_fixed' | 'checked',
  ): Promise<void>;
  markReturned(shopId: string, batchId: string, deviceId: string): Promise<void>;
  upsertCategory(shopId: string, c: Omit<Category, 'id'> & { id?: string }): Promise<string>;
  renameCompany(shopId: string, companyId: string, name: string): Promise<void>;
  mergeCompanies(shopId: string, fromId: string, intoId: string): Promise<void>; // repoints medicines, deletes fromId
  mergeCategories(shopId: string, fromId: string, intoId: string): Promise<void>;
}

// Task 16 adds `check: CheckRepo`.
export interface Repos {
  shop: ShopRepo;
  inventory: InventoryRepo;
}
