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
import { descendantIds } from '@/domain/tree';
import { DEFAULT_UNITS, cleanUnit } from '@/domain/types';
import { newId } from '@/lib/ids';
import type { CheckSession, Repos, Unsub } from '../repositories';
import { planIntake } from '../shared/intake';
import {
  CATEGORIES,
  DEFAULT_ALERT_DAYS,
  DEFAULT_NOTIFY_TIME,
  checkDeletable,
  checkMerge,
  folderName,
  moveChange,
  newJoinSecret,
  returnChange,
  sellOneChange,
  setCountChange,
  type StockChange,
} from '../shared/mutations';

type ShopState = {
  shop: Shop;
  devices: Device[];
  categories: Category[];
  companies: Company[];
  medicines: Medicine[];
  batches: Batch[];
  bills: Bill[];
  events: StockEvent[];
  checks: Record<string, CheckSession>;
};

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
  const applyChange = (s: ShopState, c: StockChange) => {
    s.batches = s.batches.map((b) => (b.id === c.batch.id ? c.batch : b));
    s.events.push(c.event);
  };
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
        const joinSecret = newJoinSecret();
        shops.set(shopId, {
          shop: {
            id: shopId,
            name,
            alertDays: { ...DEFAULT_ALERT_DAYS },
            notifyTime: DEFAULT_NOTIFY_TIME,
            joinSecret,
            units: [...DEFAULT_UNITS],
          },
          devices: [{ id: deviceId, displayName, joinedAt: now(), removed: false }],
          categories: CATEGORIES.map((n, order) => ({
            id: newId(),
            name: n,
            order,
            lastCheckedAt: null,
            parentId: null,
          })),
          companies: [],
          medicines: [],
          batches: [],
          bills: [],
          events: [],
          checks: {},
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
      addUnit: (shopId, unit, deviceId) =>
        write(shopId, deviceId, (s) => {
          const u = cleanUnit(unit);
          const list = s.shop.units?.length ? s.shop.units : [...DEFAULT_UNITS];
          s.shop.units = list.includes(u) ? list : [...list, u];
        }),
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
        const next = newJoinSecret();
        await write(shopId, byDeviceId, (s) => void (s.shop.joinSecret = next));
        return next;
      },
    },
    inventory: {
      watchSyncState: (_shopId, cb) => {
        cb({ online: true, pending: 0 });
        return () => {};
      },
      watchCategories: (shopId, cb) =>
        watch(shopId, (s) => [...s.categories].sort((a, b) => a.order - b.order), cb),
      watchCompanies: (shopId, cb) => watch(shopId, (s) => s.companies, cb),
      watchMedicines: (shopId, cb) => watch(shopId, (s) => s.medicines, cb),
      watchLiveBatches: (shopId, cb) =>
        watch(shopId, (s) => s.batches.filter((b) => b.status === 'active'), cb),
      watchBill: (shopId, billId, cb) =>
        watch(shopId, (s) => s.bills.find((b) => b.id === billId) ?? null, cb),
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
          const p = planIntake(s, drafts, bill, deviceId, now());
          if (p.bill) s.bills.push(p.bill);
          s.companies.push(...p.companies);
          s.medicines.push(...p.medicines);
          for (const b of p.batches) {
            const i = s.batches.findIndex((x) => x.id === b.id);
            if (i >= 0) s.batches[i] = b;
            else s.batches.push(b);
          }
          s.events.push(...p.events);
        }),
      sellOne: (shopId, batchId, deviceId) =>
        write(shopId, deviceId, (s) =>
          applyChange(s, sellOneChange(batchOf(s, batchId), deviceId, now())),
        ),
      setCount: (shopId, batchId, qty, deviceId, type) =>
        write(shopId, deviceId, (s) =>
          applyChange(s, setCountChange(batchOf(s, batchId), qty, type, deviceId, now())),
        ),
      markReturned: (shopId, batchId, deviceId) =>
        write(shopId, deviceId, (s) =>
          applyChange(s, returnChange(batchOf(s, batchId), deviceId, now())),
        ),
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
      reorderCategories: (shopId, orderedIds, deviceId) =>
        write(shopId, deviceId, (s) => {
          orderedIds.forEach((id, order) => {
            const c = s.categories.find((x) => x.id === id);
            if (!c) throw new Error('category not found');
            c.order = order;
          });
        }),
      moveCategory: (shopId, id, newParentId, deviceId) =>
        write(shopId, deviceId, (s) => {
          const patch = moveChange(s.categories, id, newParentId);
          Object.assign(
            s.categories.find((c) => c.id === id)!,
            patch,
          );
        }),
      renameCategory: (shopId, id, name, deviceId) =>
        write(shopId, deviceId, (s) => {
          const n = folderName(name);
          const c = s.categories.find((x) => x.id === id);
          if (!c) throw new Error('category not found');
          c.name = n;
        }),
      deleteCategory: (shopId, id, deviceId) =>
        write(shopId, deviceId, (s) => {
          checkDeletable(s.categories, s.medicines, id);
          s.categories = s.categories.filter((c) => c.id !== id);
        }),
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
    check: {
      watchCheck: (shopId, categoryId, cb) =>
        watch(shopId, (s) => s.checks[categoryId] ?? null, cb),
      markChecked: (shopId, categoryId, batchId, qty, deviceId) =>
        write(shopId, deviceId, (s) => {
          const at = now();
          applyChange(s, setCountChange(batchOf(s, batchId), qty, 'checked', deviceId, at));
          const c = (s.checks[categoryId] ??= { categoryId, startedAt: at, checked: {} });
          c.checked[batchId] = { by: deviceId, at };
        }),
      async finishCheck(shopId, categoryId, ids) {
        const s = get(shopId);
        const checked = s.checks[categoryId]?.checked ?? {};
        const complete = ids.every((id) => id in checked);
        if (complete) {
          if (!s.categories.some((x) => x.id === categoryId)) throw new Error('category not found');
          const scope = new Set([categoryId, ...descendantIds(s.categories, categoryId)]);
          const at = now();
          s.categories.forEach((c) => scope.has(c.id) && (c.lastCheckedAt = at));
          delete s.checks[categoryId];
          notify();
        }
        return { complete };
      },
    },
  };
}
