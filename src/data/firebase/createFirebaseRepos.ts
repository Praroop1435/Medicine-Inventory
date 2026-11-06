import { getApp } from '@react-native-firebase/app';
import {
  CACHE_SIZE_UNLIMITED,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  increment,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Query,
  type WriteBatch,
} from '@react-native-firebase/firestore';
import type { Batch, Bill, Company, Medicine, Shop, StockEvent } from '@/domain/types';
import { descendantIds } from '@/domain/tree';
import { newId } from '@/lib/ids';
import type { CheckSession, Repos, Unsub } from '../repositories';
import { planIntake, resolveMedicine } from '../shared/intake';
import {
  CATEGORIES,
  DEFAULT_ALERT_DAYS,
  DEFAULT_NOTIFY_TIME,
  checkDeletable,
  checkMerge,
  moveChange,
  newJoinSecret,
  returnChange,
  sellOneChange,
  setCountChange,
  type StockChange,
} from '../shared/mutations';
import { ensureSignedIn } from './auth';
import {
  batchFromDoc,
  batchToDoc,
  categoryFromDoc,
  deviceFromDoc,
  withId,
  withoutId,
  type BatchDoc,
  type DeviceDoc,
} from './converters';
import { colPath, docPath, shopPath, type ShopCollection } from './paths';

// RNFirebase rejects with native errors carrying codes like 'firestore/permission-denied'.
type CodedError = Error & { code?: string };

const OFFLINE = 'No internet connection. Setting up or joining a shop needs the internet.';
const isOffline = (e: CodedError) => /unavailable|network|deadline/.test(e.code ?? '');

// Rejects when the server can't confirm in time; offline commits otherwise never settle.
function online<T>(p: Promise<T>, ms = 15_000): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>(
    (_, rej) => (t = setTimeout(() => rej(new Error(OFFLINE)), ms)),
  );
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

// Thin mapping onto Firestore: behaviour lives in ../shared. Membership is enforced by
// firebase/firestore.rules (device doc id == anonymous uid), so the deviceId arguments
// only label events.
//
// Offline-first (spec §5): reads use the default source (cache when offline), mutations
// validate against that data, then commit a write batch WITHOUT awaiting the server.
// Late failures go to onWriteError. Only createShop/joinShop wait for the server.
const asMemberError = (e: unknown) =>
  (e as CodedError).code === 'firestore/permission-denied' ? new Error('not a member') : e;

// Mutations read cache-first: a default-source read waits for the server on a weak connection
// and bills a read per doc. Fall back to the default read only when the cache has nothing.
async function readDoc(r: DocumentReference) {
  try {
    const s = await getDocFromCache(r);
    if (s.exists()) return s;
  } catch {
    // not cached
  }
  return getDoc(r).catch((e) => Promise.reject(asMemberError(e)));
}
async function readDocs(q: Query) {
  try {
    const s = await getDocsFromCache(q);
    if (!s.empty) return s;
  } catch {
    // not cached
  }
  return getDocs(q).catch((e) => Promise.reject(asMemberError(e)));
}

export function createFirebaseRepos(opts: { onWriteError?: (e: Error) => void } = {}): Repos {
  const onWriteError = opts.onWriteError ?? ((e: Error) => console.warn('firestore write', e));
  const db = initializeFirestore(getApp(), {
    persistence: true,
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  });
  const signIn = () =>
    online(ensureSignedIn()).catch((e: CodedError) => {
      throw isOffline(e) ? new Error(OFFLINE) : e;
    });
  const ref = (shopId: string, c: ShopCollection, id: string) => doc(db, docPath(shopId, c, id));
  const col = (shopId: string, c: ShopCollection) => collection(db, colPath(shopId, c));
  // shortcut: listener errors (e.g. after this phone is removed) are only logged; surface them in the UI if needed.
  const onError = (e: CodedError) => console.warn('firestore listener', e.code, e.message);
  const list = <T>(
    q: Query,
    map: (id: string, d: DocumentData) => T,
    cb: (v: T[]) => void,
  ): Unsub => onSnapshot(q, (s) => cb(s.docs.map((d) => map(d.id, d.data()))), onError);

  const commit = (wb: WriteBatch) =>
    void wb.commit().catch((e: unknown) => onWriteError(asMemberError(e) as Error));
  const write = (fill: (wb: WriteBatch) => void) => {
    const wb = writeBatch(db);
    fill(wb);
    commit(wb);
  };

  // Validates with the shared change against the (possibly cached) batch, then writes only the
  // fields that change. `patch` gets the result so qty can be an increment.
  const change = async (
    shopId: string,
    batchId: string,
    f: (b: Batch, at: number) => StockChange,
    patch: (c: StockChange) => DocumentData,
    also?: (wb: WriteBatch, c: StockChange) => void,
  ) => {
    const r = ref(shopId, 'batches', batchId);
    const s = await readDoc(r);
    if (!s.exists()) throw new Error('batch not found');
    const c = f(batchFromDoc(s.id, s.data() as BatchDoc), Date.now());
    write((wb) => {
      wb.update(r, patch(c));
      wb.set(ref(shopId, 'events', c.event.id), withoutId(c.event));
      also?.(wb, c);
    });
  };
  // Status is only written when it changes, so a stale 'active' never overwrites a return elsewhere.
  const closed = (c: StockChange) =>
    c.batch.status === 'active' ? {} : { status: c.batch.status };

  const merge = async (
    shopId: string,
    c: 'companies' | 'categories',
    field: 'companyId' | 'categoryId',
    fromId: string,
    intoId: string,
  ) => {
    const found = await Promise.all([
      readDoc(ref(shopId, c, fromId)),
      readDoc(ref(shopId, c, intoId)),
    ]);
    checkMerge(
      fromId,
      intoId,
      found.filter((s) => s.exists()).map((s) => ({ id: s.id })),
    );
    const meds = await readDocs(query(col(shopId, 'medicines'), where(field, '==', fromId)));
    // shortcut: one batch caps at 500 writes; fine for a single company/category in a 2,000-medicine shop.
    write((wb) => {
      meds.docs.forEach((m) => wb.update(m.ref, { [field]: intoId }));
      wb.delete(ref(shopId, c, fromId));
    });
  };
  const categories = async (shopId: string) =>
    (await readDocs(col(shopId, 'categories'))).docs.map((d) => categoryFromDoc(d.id, d.data()));
  const update = (r: ReturnType<typeof ref>, data: DocumentData) =>
    write((wb) => wb.update(r, data));

  return {
    shop: {
      async createShop(name, displayName) {
        const deviceId = await signIn();
        const shopId = newId();
        const joinSecret = newJoinSecret();
        const wb = writeBatch(db);
        wb.set(doc(db, shopPath(shopId)), {
          name,
          alertDays: { ...DEFAULT_ALERT_DAYS },
          notifyTime: DEFAULT_NOTIFY_TIME,
          joinSecret,
        });
        const device: DeviceDoc = { displayName, joinedAt: Date.now(), removed: false, joinSecret };
        wb.set(ref(shopId, 'devices', deviceId), device);
        CATEGORIES.forEach((n, order) =>
          wb.set(ref(shopId, 'categories', newId()), {
            name: n,
            order,
            lastCheckedAt: null,
            parentId: null,
          }),
        );
        try {
          await online(wb.commit());
        } catch (e) {
          throw isOffline(e as CodedError) ? new Error(OFFLINE) : e;
        }
        return { shopId, joinSecret, deviceId };
      },
      async joinShop(shopId, joinSecret, displayName) {
        const deviceId = await signIn();
        const device: DeviceDoc = { displayName, joinedAt: Date.now(), removed: false, joinSecret };
        const wb = writeBatch(db);
        wb.set(ref(shopId, 'devices', deviceId), device);
        try {
          await online(wb.commit());
        } catch (e) {
          const code = (e as CodedError).code;
          if (code === 'firestore/permission-denied')
            throw new Error('invalid shop or join secret');
          throw isOffline(e as CodedError) ? new Error(OFFLINE) : e;
        }
        return { deviceId };
      },
      watchShop: (shopId, cb) =>
        onSnapshot(
          doc(db, shopPath(shopId)),
          (s) => {
            if (s.exists()) cb(withId<Shop>(s.id, s.data()));
          },
          onError,
        ),
      updateShop: async (shopId, patch) => update(doc(db, shopPath(shopId)), patch),
      watchDevices: (shopId, cb) =>
        list(col(shopId, 'devices'), (id, d) => deviceFromDoc(id, d as DeviceDoc), cb),
      renameDevice: async (shopId, deviceId, name) =>
        update(ref(shopId, 'devices', deviceId), { displayName: name }),
      removeDevice: async (shopId, deviceId) =>
        update(ref(shopId, 'devices', deviceId), { removed: true }),
      async rotateJoinSecret(shopId) {
        const next = newJoinSecret();
        update(doc(db, shopPath(shopId)), { joinSecret: next });
        return next;
      },
    },
    inventory: {
      // pending = live batch docs with unsynced local writes; online = the latest snapshot came from the server.
      // shortcut: only batches are watched (stock changes are the writes that matter); other collections' pending writes aren't counted.
      watchSyncState: (shopId, cb) =>
        onSnapshot(
          query(col(shopId, 'batches'), where('status', '==', 'active')),
          { includeMetadataChanges: true },
          (s) =>
            cb({
              online: !s.metadata.fromCache,
              pending: s.docs.filter((d) => d.metadata.hasPendingWrites).length,
            }),
          onError,
        ),
      watchCategories: (shopId, cb) =>
        list(query(col(shopId, 'categories'), orderBy('order')), categoryFromDoc, cb),
      watchCompanies: (shopId, cb) => list(col(shopId, 'companies'), withId<Company>, cb),
      watchMedicines: (shopId, cb) => list(col(shopId, 'medicines'), withId<Medicine>, cb),
      watchLiveBatches: (shopId, cb) =>
        list(
          query(col(shopId, 'batches'), where('status', '==', 'active')),
          (id, d) => batchFromDoc(id, d as BatchDoc),
          cb,
        ),
      watchBill: (shopId, billId, cb) =>
        onSnapshot(
          ref(shopId, 'bills', billId),
          (s) => cb(s.exists() ? withId<Bill>(s.id, s.data() as DocumentData) : null),
          onError,
        ),
      watchMedicineEvents: (shopId, medicineId, n, cb) =>
        list(
          query(
            col(shopId, 'events'),
            where('medicineId', '==', medicineId),
            orderBy('at', 'desc'),
            limit(n),
          ),
          withId<StockEvent>,
          cb,
        ),
      async saveIntake(shopId, drafts, bill, deviceId) {
        const [medSnap, coSnap] = await Promise.all([
          readDocs(col(shopId, 'medicines')),
          readDocs(col(shopId, 'companies')),
        ]);
        const medicines = medSnap.docs.map((d) => withId<Medicine>(d.id, d.data()));
        const companies = coSnap.docs.map((d) => withId<Company>(d.id, d.data()));
        // Only batches of medicines the drafts resolve to can be duplicates.
        const medIds = new Set(drafts.flatMap((d) => resolveMedicine(d, medicines)?.id ?? []));
        const found = await Promise.all(
          [...medIds].map((id) =>
            readDocs(
              query(
                col(shopId, 'batches'),
                where('medicineId', '==', id),
                where('status', '==', 'active'),
              ),
            ),
          ),
        );
        const batches = found.flatMap((s) =>
          s.docs.map((d) => batchFromDoc(d.id, d.data() as BatchDoc)),
        );
        const oldQty = new Map(batches.map((b) => [b.id, b.qty]));
        const p = planIntake({ medicines, companies, batches }, drafts, bill, deviceId, Date.now());
        write((wb) => {
          if (p.bill) wb.set(ref(shopId, 'bills', p.bill.id), withoutId(p.bill));
          p.companies.forEach((c) => wb.set(ref(shopId, 'companies', c.id), withoutId(c)));
          p.medicines.forEach((m) => wb.set(ref(shopId, 'medicines', m.id), withoutId(m)));
          p.batches.forEach((b) => {
            const old = oldQty.get(b.id);
            // Existing batch: increment so a concurrent sale on another phone isn't overwritten.
            if (old === undefined) wb.set(ref(shopId, 'batches', b.id), batchToDoc(b));
            else wb.update(ref(shopId, 'batches', b.id), { qty: increment(b.qty - old) });
          });
          p.events.forEach((e) => wb.set(ref(shopId, 'events', e.id), withoutId(e)));
        });
      },
      sellOne: (shopId, batchId, deviceId) =>
        change(
          shopId,
          batchId,
          (b, at) => sellOneChange(b, deviceId, at),
          (c) => ({ qty: increment(-1), ...closed(c) }),
        ),
      // Absolute qty: the shelf count is the truth.
      setCount: (shopId, batchId, qty, deviceId, type) =>
        change(
          shopId,
          batchId,
          (b, at) => setCountChange(b, qty, type, deviceId, at),
          (c) => ({ qty: c.batch.qty, ...closed(c) }),
        ),
      markReturned: (shopId, batchId, deviceId) =>
        change(
          shopId,
          batchId,
          (b, at) => returnChange(b, deviceId, at),
          (c) => closed(c),
        ),
      async upsertCategory(shopId, c) {
        const id = c.id ?? newId();
        write((wb) => wb.set(ref(shopId, 'categories', id), withoutId({ ...c, id })));
        return id;
      },
      async reorderCategories(shopId, orderedIds) {
        write((wb) =>
          orderedIds.forEach((id, order) => wb.update(ref(shopId, 'categories', id), { order })),
        );
      },
      async moveCategory(shopId, id, newParentId) {
        update(
          ref(shopId, 'categories', id),
          moveChange(await categories(shopId), id, newParentId),
        );
      },
      async deleteCategory(shopId, id) {
        const [cats, meds] = await Promise.all([
          categories(shopId),
          readDocs(query(col(shopId, 'medicines'), where('categoryId', '==', id), limit(1))),
        ]);
        checkDeletable(
          cats,
          meds.docs.map((d) => withId<Medicine>(d.id, d.data())),
          id,
        );
        write((wb) => wb.delete(ref(shopId, 'categories', id)));
      },
      renameCompany: async (shopId, companyId, name) =>
        update(ref(shopId, 'companies', companyId), { name: name.trim() }),
      mergeCompanies: (shopId, fromId, intoId) =>
        merge(shopId, 'companies', 'companyId', fromId, intoId),
      mergeCategories: (shopId, fromId, intoId) =>
        merge(shopId, 'categories', 'categoryId', fromId, intoId),
    },
    check: {
      watchCheck: (shopId, categoryId, cb) =>
        onSnapshot(
          ref(shopId, 'checks', categoryId),
          (s) => cb(s.exists() ? (s.data() as CheckSession) : null),
          onError,
        ),
      async markChecked(shopId, categoryId, batchId, qty, deviceId) {
        const r = ref(shopId, 'checks', categoryId);
        const started = await getDocFromCache(r).then(
          (s) => s.exists(),
          () => false,
        );
        await change(
          shopId,
          batchId,
          (b, at) => setCountChange(b, qty, 'checked', deviceId, at),
          (c) => ({ qty: c.batch.qty, ...closed(c) }),
          // Merge deep-merges `checked`, so two phones ticking offline keep both rows.
          (wb, c) =>
            wb.set(
              r,
              {
                categoryId,
                ...(started ? {} : { startedAt: c.event.at }),
                checked: { [batchId]: { by: deviceId, at: c.event.at } },
              },
              { merge: true },
            ),
        );
      },
      async finishCheck(shopId, categoryId, ids) {
        const r = ref(shopId, 'checks', categoryId);
        const s = await readDoc(r);
        const checked = s.exists() ? (s.data() as CheckSession).checked : {};
        const complete = ids.every((id) => id in checked);
        if (complete) {
          const at = Date.now();
          const inside = descendantIds(await categories(shopId), categoryId);
          write((wb) => {
            for (const id of [categoryId, ...inside])
              wb.update(ref(shopId, 'categories', id), { lastCheckedAt: at });
            wb.delete(r);
          });
        }
        return { complete };
      },
    },
  };
}
