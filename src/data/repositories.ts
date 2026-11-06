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
    patch: Partial<Pick<Shop, 'name' | 'alertDays' | 'notifyTime' | 'nightTime'>>,
    deviceId: string,
  ): Promise<void>;
  /** Adds a unit to the shop's list (trimmed, lowercase); a no-op when already there. */
  addUnit(shopId: string, unit: string, deviceId: string): Promise<void>;
  watchDevices(shopId: string, cb: (d: Device[]) => void): Unsub;
  /** Calls onLost once when this phone is removed from the shop (or may no longer read it). */
  watchMembership(shopId: string, deviceId: string, onLost: () => void): Unsub;
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
  watchBill(shopId: string, billId: string, cb: (b: Bill | null) => void): Unsub;
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
  /** Sets order = index for each id, touching only `order`, atomically. Pass one sibling group. */
  reorderCategories(shopId: string, orderedIds: string[], deviceId: string): Promise<void>;
  /** Writes only parentId and order (last among the new siblings). Rejects a cycle. */
  moveCategory(
    shopId: string,
    id: string,
    newParentId: string | null,
    deviceId: string,
  ): Promise<void>;
  /** Writes only `name` (trimmed), so a stale snapshot can't undo another phone's changes. */
  renameCategory(shopId: string, id: string, name: string, deviceId: string): Promise<void>;
  /** Rejects unless the folder has no sub-folders and no medicines. */
  deleteCategory(shopId: string, id: string, deviceId: string): Promise<void>;
}

/** One category's stock check in progress; resumable from any phone. */
export type CheckSession = {
  categoryId: string;
  startedAt: number;
  checked: Record<string, { by: string; at: number }>; // batchId -> who ticked it, when
};

export interface CheckRepo {
  watchCheck(shopId: string, categoryId: string, cb: (s: CheckSession | null) => void): Unsub;
  /** setCount(…, 'checked') plus the row in the session, in one atomic write. */
  markChecked(
    shopId: string,
    categoryId: string,
    batchId: string,
    qty: number,
    deviceId: string,
  ): Promise<void>;
  /** Complete iff every id is checked: then sets lastCheckedAt on the folder and every folder inside it, and deletes the session. */
  finishCheck(
    shopId: string,
    categoryId: string,
    totalLiveBatchIds: string[],
  ): Promise<{ complete: boolean }>;
}

export interface Repos {
  shop: ShopRepo;
  inventory: InventoryRepo;
  check: CheckRepo;
}
