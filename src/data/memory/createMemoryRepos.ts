import { draftIssues } from '@/domain/draft';
import { findMedicineMatch, normalizeName } from '@/domain/matching';
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
import { newId } from '@/lib/ids';
import type { Repos, Unsub } from '../repositories';

const CATEGORIES = [
  'Antibiotics',
  'Cough syrups',
  'Pain relief',
  'Balms',
  'Lotions',
  'Eye/ear drops',
  'Tablets (general)',
  'Vitamins',
  'Others',
];

type ShopState = {
  shop: Shop;
  devices: Device[];
  categories: Category[];
  companies: Company[];
  medicines: Medicine[];
  batches: Batch[];
  bills: Bill[];
  events: StockEvent[];
};

const secret = () =>
  Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')).join('');
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function checkMerge(fromId: string, intoId: string, all: { id: string }[]) {
  if (fromId === intoId) throw new Error('cannot merge into the same record');
  if (!all.some((x) => x.id === fromId) || !all.some((x) => x.id === intoId))
    throw new Error('record not found');
}

export function createMemoryRepos(now: () => number = Date.now): Repos {
  const shops = new Map<string, ShopState>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const get = (id: string): ShopState => {
    const s = shops.get(id);
    if (!s) throw new Error('shop not found');
    return s;
  };
  const member = (s: ShopState, deviceId: string) => {
    if (!s.devices.some((d) => d.id === deviceId && !d.removed))
      throw new Error('device is not a member of this shop');
  };
  // Snapshots are copied so subscribers can't mutate state.
  const watch = <T>(shopId: string, pick: (s: ShopState) => T, cb: (v: T) => void): Unsub => {
    const emit = () => {
      const s = shops.get(shopId);
      if (s) cb(structuredClone(pick(s)));
    };
    listeners.add(emit);
    emit();
    return () => void listeners.delete(emit);
  };
  const write = async (shopId: string, deviceId: string, fn: (s: ShopState) => void) => {
    member(get(shopId), deviceId);
    const s = structuredClone(get(shopId)); // all-or-nothing: a throw leaves state untouched
    fn(s);
    shops.set(shopId, s);
    notify();
  };
  const event = (
    s: ShopState,
    b: Batch,
    type: StockEvent['type'],
    delta: number,
    deviceId: string,
  ) =>
    s.events.push({
      id: newId(),
      batchId: b.id,
      medicineId: b.medicineId,
      type,
      delta,
      deviceId,
      at: now(),
    });
  const batchOf = (s: ShopState, id: string) => {
    const b = s.batches.find((x) => x.id === id);
    if (!b) throw new Error('batch not found');
    return b;
  };

  return {
    shop: {
      async createShop(name, displayName) {
        const shopId = newId();
        const deviceId = newId();
        const joinSecret = secret();
        shops.set(shopId, {
          shop: {
            id: shopId,
            name,
            alertDays: { first: 90, second: 30 },
            notifyTime: '09:00',
            joinSecret,
          },
          devices: [{ id: deviceId, displayName, joinedAt: now(), removed: false }],
          categories: CATEGORIES.map((n, order) => ({
            id: newId(),
            name: n,
            order,
            lastCheckedAt: null,
          })),
          companies: [],
          medicines: [],
          batches: [],
          bills: [],
          events: [],
        });
        notify();
        return { shopId, joinSecret, deviceId };
      },
      async joinShop(shopId, joinSecret, displayName) {
        const s = shops.get(shopId);
        if (!s || s.shop.joinSecret !== joinSecret) throw new Error('invalid shop or join secret');
        const deviceId = newId();
        s.devices.push({ id: deviceId, displayName, joinedAt: now(), removed: false });
        notify();
        return { deviceId };
      },
      watchShop: (shopId, cb) => watch(shopId, (s) => s.shop, cb),
      updateShop: (shopId, patch, deviceId) =>
        write(shopId, deviceId, (s) => void Object.assign(s.shop, patch)),
      watchDevices: (shopId, cb) => watch(shopId, (s) => s.devices, cb),
      async renameDevice(shopId, deviceId, name) {
        const d = get(shopId).devices.find((x) => x.id === deviceId);
        if (!d) throw new Error('device is not a member of this shop');
        d.displayName = name;
        notify();
      },
      removeDevice: (shopId, deviceId, byDeviceId) =>
        write(shopId, byDeviceId, (s) => {
          const d = s.devices.find((x) => x.id === deviceId);
          if (d) d.removed = true;
        }),
      async rotateJoinSecret(shopId, byDeviceId) {
        const next = secret();
        await write(shopId, byDeviceId, (s) => void (s.shop.joinSecret = next));
        return next;
      },
    },
    inventory: {
      watchCategories: (shopId, cb) =>
        watch(shopId, (s) => [...s.categories].sort((a, b) => a.order - b.order), cb),
      watchCompanies: (shopId, cb) => watch(shopId, (s) => s.companies, cb),
      watchMedicines: (shopId, cb) => watch(shopId, (s) => s.medicines, cb),
      watchLiveBatches: (shopId, cb) =>
        watch(shopId, (s) => s.batches.filter((b) => b.status === 'active'), cb),
      watchMedicineEvents: (shopId, medicineId, limit, cb) =>
        watch(
          shopId,
          (s) =>
            s.events
              .filter((e) => e.medicineId === medicineId)
              .reverse() // insertion order breaks timestamp ties
              .sort((a, b) => b.at - a.at)
              .slice(0, limit),
          cb,
        ),
      saveIntake: (shopId, drafts, bill, deviceId) =>
        write(shopId, deviceId, (s) => {
          const billId = bill ? newId() : null;
          if (bill && billId) s.bills.push({ ...bill, id: billId, createdAt: now() });
          for (const d of drafts) {
            let med =
              s.medicines.find((m) => m.id === d.matchedMedicineId) ??
              findMedicineMatch(d.medicineName, s.medicines);
            if (draftIssues({ ...d, matchedMedicineId: med?.id ?? null }).length || !d.expiry)
              throw new Error('incomplete draft');
            if (d.expiry.month < 1 || d.expiry.month > 12) throw new Error('invalid expiry');
            if (!med) {
              if (!d.categoryId || !d.unit) throw new Error('incomplete draft');
              const cn = normalizeName(d.companyName);
              let co = s.companies.find((c) => normalizeName(c.name) === cn);
              if (!co) s.companies.push((co = { id: newId(), name: d.companyName.trim() }));
              s.medicines.push(
                (med = {
                  id: newId(),
                  name: d.medicineName.trim(),
                  categoryId: d.categoryId,
                  companyId: co.id,
                  unit: d.unit,
                }),
              );
            }
            const existing = s.batches.find(
              (b) => b.status === 'active' && b.medicineId === med.id && same(b.batchNo, d.batchNo),
            );
            if (existing) {
              existing.qty += d.qty!;
              event(s, existing, 'added', d.qty!, deviceId);
            } else {
              const b: Batch = {
                id: newId(),
                medicineId: med.id,
                batchNo: d.batchNo.trim(),
                expiry: d.expiry!,
                qty: d.qty!,
                billId,
                status: 'active',
                createdAt: now(),
              };
              s.batches.push(b);
              event(s, b, 'added', d.qty!, deviceId);
            }
          }
        }),
      sellOne: (shopId, batchId, deviceId) =>
        write(shopId, deviceId, (s) => {
          const b = batchOf(s, batchId);
          if (b.status !== 'active' || b.qty < 1) throw new Error('no stock to sell');
          b.qty -= 1;
          if (b.qty === 0) b.status = 'removed';
          event(s, b, 'sold', -1, deviceId);
        }),
      setCount: (shopId, batchId, qty, deviceId, type) =>
        write(shopId, deviceId, (s) => {
          if (!Number.isInteger(qty) || qty < 0) throw new Error('invalid quantity');
          const b = batchOf(s, batchId);
          if (b.status !== 'active') throw new Error('batch is not active');
          const old = b.qty;
          b.qty = qty;
          if (qty === 0) b.status = 'removed';
          event(s, b, type, qty - old, deviceId);
        }),
      markReturned: (shopId, batchId, deviceId) =>
        write(shopId, deviceId, (s) => {
          const b = batchOf(s, batchId);
          if (b.status !== 'active') throw new Error('batch is not active');
          b.status = 'returned';
          event(s, b, 'returned', -b.qty, deviceId);
        }),
      async upsertCategory(shopId, c) {
        const s = get(shopId);
        const id = c.id ?? newId();
        const next = { ...c, id };
        const i = s.categories.findIndex((x) => x.id === id);
        if (i >= 0) s.categories[i] = next;
        else s.categories.push(next);
        notify();
        return id;
      },
      async renameCompany(shopId, companyId, name) {
        const co = get(shopId).companies.find((c) => c.id === companyId);
        if (!co) throw new Error('company not found');
        co.name = name.trim();
        notify();
      },
      async mergeCompanies(shopId, fromId, intoId) {
        const s = get(shopId);
        checkMerge(fromId, intoId, s.companies);
        s.medicines.forEach((m) => m.companyId === fromId && (m.companyId = intoId));
        s.companies = s.companies.filter((c) => c.id !== fromId);
        notify();
      },
      async mergeCategories(shopId, fromId, intoId) {
        const s = get(shopId);
        checkMerge(fromId, intoId, s.categories);
        s.medicines.forEach((m) => m.categoryId === fromId && (m.categoryId = intoId));
        s.categories = s.categories.filter((c) => c.id !== fromId);
        notify();
      },
    },
  };
}
