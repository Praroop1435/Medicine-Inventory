import { getApp } from '@react-native-firebase/app';
import {
  CACHE_SIZE_UNLIMITED,
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
} from '@react-native-firebase/firestore';
import type { Batch, Category, Company, Medicine, Shop, StockEvent } from '@/domain/types';
import { newId } from '@/lib/ids';
import type { Repos, Unsub } from '../repositories';
import { planIntake, resolveMedicine } from '../shared/intake';
import {
  CATEGORIES,
  DEFAULT_ALERT_DAYS,
  DEFAULT_NOTIFY_TIME,
  checkMerge,
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
  deviceFromDoc,
  withId,
  withoutId,
  type BatchDoc,
  type DeviceDoc,
} from './converters';
import { colPath, docPath, shopPath, type ShopCollection } from './paths';

// RNFirebase rejects with native errors carrying codes like 'firestore/permission-denied'.
type CodedError = Error & { code?: string };

// Thin mapping onto Firestore: behaviour lives in ../shared. Membership is enforced by
// firebase/firestore.rules (device doc id == anonymous uid), so the deviceId arguments
// only label events.
export function createFirebaseRepos(): Repos {
  const db = initializeFirestore(getApp(), {
    persistence: true,
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
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

  const change = (shopId: string, batchId: string, f: (b: Batch, at: number) => StockChange) =>
    runTransaction(db, async (tx) => {
      const r = ref(shopId, 'batches', batchId);
      const s = await tx.get(r);
      if (!s.exists()) throw new Error('batch not found');
      const c = f(batchFromDoc(s.id, s.data() as BatchDoc), Date.now());
      tx.set(r, batchToDoc(c.batch));
      tx.set(ref(shopId, 'events', c.event.id), withoutId(c.event));
    });

  const merge = async (
    shopId: string,
    c: 'companies' | 'categories',
    field: 'companyId' | 'categoryId',
    fromId: string,
    intoId: string,
  ) => {
    const found = await Promise.all([
      getDoc(ref(shopId, c, fromId)),
      getDoc(ref(shopId, c, intoId)),
    ]);
    checkMerge(
      fromId,
      intoId,
      found.filter((s) => s.exists()).map((s) => ({ id: s.id })),
    );
    const meds = await getDocs(query(col(shopId, 'medicines'), where(field, '==', fromId)));
    // shortcut: one batch caps at 500 writes; fine for a single company/category in a 2,000-medicine shop.
    const wb = writeBatch(db);
    meds.docs.forEach((m) => wb.update(m.ref, { [field]: intoId }));
    wb.delete(ref(shopId, c, fromId));
    await wb.commit();
  };

  return {
    shop: {
      async createShop(name, displayName) {
        const deviceId = await ensureSignedIn();
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
          wb.set(ref(shopId, 'categories', newId()), { name: n, order, lastCheckedAt: null }),
        );
        await wb.commit();
        return { shopId, joinSecret, deviceId };
      },
      async joinShop(shopId, joinSecret, displayName) {
        const deviceId = await ensureSignedIn();
        const device: DeviceDoc = { displayName, joinedAt: Date.now(), removed: false, joinSecret };
        try {
          await setDoc(ref(shopId, 'devices', deviceId), device);
        } catch (e) {
          if ((e as CodedError).code === 'firestore/permission-denied')
            throw new Error('invalid shop or join secret');
          throw e;
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
      updateShop: (shopId, patch) => updateDoc(doc(db, shopPath(shopId)), patch),
      watchDevices: (shopId, cb) =>
        list(col(shopId, 'devices'), (id, d) => deviceFromDoc(id, d as DeviceDoc), cb),
      renameDevice: (shopId, deviceId, name) =>
        updateDoc(ref(shopId, 'devices', deviceId), { displayName: name }),
      removeDevice: (shopId, deviceId) =>
        updateDoc(ref(shopId, 'devices', deviceId), { removed: true }),
      async rotateJoinSecret(shopId) {
        const next = newJoinSecret();
        await updateDoc(doc(db, shopPath(shopId)), { joinSecret: next });
        return next;
      },
    },
    inventory: {
      watchCategories: (shopId, cb) =>
        list(query(col(shopId, 'categories'), orderBy('order')), withId<Category>, cb),
      watchCompanies: (shopId, cb) => list(col(shopId, 'companies'), withId<Company>, cb),
      watchMedicines: (shopId, cb) => list(col(shopId, 'medicines'), withId<Medicine>, cb),
      watchLiveBatches: (shopId, cb) =>
        list(
          query(col(shopId, 'batches'), where('status', '==', 'active')),
          (id, d) => batchFromDoc(id, d as BatchDoc),
          cb,
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
        // Transactions can only read documents, not queries: find candidate batches first,
        // then re-read them inside the transaction so the duplicate guard sees fresh qty/status.
        const [medSnap, coSnap] = await Promise.all([
          getDocs(col(shopId, 'medicines')),
          getDocs(col(shopId, 'companies')),
        ]);
        const medicines = medSnap.docs.map((d) => withId<Medicine>(d.id, d.data()));
        const companies = coSnap.docs.map((d) => withId<Company>(d.id, d.data()));
        const medIds = new Set(drafts.flatMap((d) => resolveMedicine(d, medicines)?.id ?? []));
        const found = await Promise.all(
          [...medIds].map((id) =>
            getDocs(
              query(
                col(shopId, 'batches'),
                where('medicineId', '==', id),
                where('status', '==', 'active'),
              ),
            ),
          ),
        );
        const candidates = found.flatMap((s) => s.docs.map((d) => d.ref));
        await runTransaction(db, async (tx) => {
          const fresh = await Promise.all(candidates.map((r) => tx.get(r)));
          const batches = fresh
            .filter((s) => s.exists())
            .map((s) => batchFromDoc(s.id, s.data() as BatchDoc));
          const p = planIntake(
            { medicines, companies, batches },
            drafts,
            bill,
            deviceId,
            Date.now(),
          );
          if (p.bill) tx.set(ref(shopId, 'bills', p.bill.id), withoutId(p.bill));
          p.companies.forEach((c) => tx.set(ref(shopId, 'companies', c.id), withoutId(c)));
          p.medicines.forEach((m) => tx.set(ref(shopId, 'medicines', m.id), withoutId(m)));
          p.batches.forEach((b) => tx.set(ref(shopId, 'batches', b.id), batchToDoc(b)));
          p.events.forEach((e) => tx.set(ref(shopId, 'events', e.id), withoutId(e)));
        });
      },
      sellOne: (shopId, batchId, deviceId) =>
        change(shopId, batchId, (b, at) => sellOneChange(b, deviceId, at)),
      setCount: (shopId, batchId, qty, deviceId, type) =>
        change(shopId, batchId, (b, at) => setCountChange(b, qty, type, deviceId, at)),
      markReturned: (shopId, batchId, deviceId) =>
        change(shopId, batchId, (b, at) => returnChange(b, deviceId, at)),
      async upsertCategory(shopId, c) {
        const id = c.id ?? newId();
        await setDoc(ref(shopId, 'categories', id), withoutId({ ...c, id }));
        return id;
      },
      renameCompany: (shopId, companyId, name) =>
        updateDoc(ref(shopId, 'companies', companyId), { name: name.trim() }),
      mergeCompanies: (shopId, fromId, intoId) =>
        merge(shopId, 'companies', 'companyId', fromId, intoId),
      mergeCategories: (shopId, fromId, intoId) =>
        merge(shopId, 'categories', 'categoryId', fromId, intoId),
    },
  };
}
