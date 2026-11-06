import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  setDoc,
  setLogLevel,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const SECRET = 'a'.repeat(24);
const NEW_SECRET = 'b'.repeat(24);
let env: RulesTestEnvironment;

const db = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const device = (joinSecret: string, removed = false) => ({
  displayName: 'Phone',
  joinedAt: 1,
  removed,
  joinSecret,
});
const batch = { medicineId: 'm1', batchNo: 'B1', expiryKey: 202706, qty: 3, status: 'active' };

beforeAll(async () => {
  setLogLevel('error'); // denied writes are expected here; keep the output readable
  env = await initializeTestEnvironment({
    projectId: 'demo-medstock',
    firestore: { rules: readFileSync(join(__dirname, 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'shops/s1'), { name: 'Shop', joinSecret: SECRET });
    await setDoc(doc(f, 'shops/s1/devices/alice'), device(SECRET));
    await setDoc(doc(f, 'shops/s1/devices/gone'), device(SECRET, true));
    await setDoc(doc(f, 'shops/s1/batches/b1'), batch);
    await setDoc(doc(f, 'shops/s1/events/e1'), { batchId: 'b1', delta: 3 });
  });
});

describe('membership', () => {
  it('a non-member or signed-out user cannot read or write the shop', async () => {
    await assertFails(getDoc(doc(db('bob'), 'shops/s1/batches/b1')));
    await assertFails(getDoc(doc(db('bob'), 'shops/s1')));
    await assertFails(getDoc(doc(db(), 'shops/s1/batches/b1')));
    await assertFails(setDoc(doc(db('bob'), 'shops/s1/batches/b2'), batch));
    await assertFails(updateDoc(doc(db('bob'), 'shops/s1'), { name: 'x' }));
  });

  it('a member can read and write', async () => {
    const f = db('alice');
    await assertSucceeds(getDoc(doc(f, 'shops/s1')));
    await assertSucceeds(getDoc(doc(f, 'shops/s1/batches/b1')));
    await assertSucceeds(setDoc(doc(f, 'shops/s1/batches/b2'), batch));
    await assertSucceeds(updateDoc(doc(f, 'shops/s1/batches/b1'), { qty: 2 }));
    await assertSucceeds(setDoc(doc(f, 'shops/s1/companies/c1'), { name: 'Co' }));
    await assertSucceeds(deleteDoc(doc(f, 'shops/s1/companies/c1')));
    await assertSucceeds(updateDoc(doc(f, 'shops/s1'), { name: 'New name' }));
    await assertSucceeds(updateDoc(doc(f, 'shops/s1/devices/gone'), { displayName: 'Old' }));
  });

  it('a removed device can neither read nor write, nor restore itself', async () => {
    const f = db('gone');
    await assertFails(getDoc(doc(f, 'shops/s1/batches/b1')));
    await assertFails(setDoc(doc(f, 'shops/s1/batches/b2'), batch));
    await assertFails(updateDoc(doc(f, 'shops/s1/devices/gone'), { removed: false }));
    await assertFails(setDoc(doc(f, 'shops/s1/devices/gone'), device(SECRET)));
  });

  it('members cannot write outside the known collections or delete devices and shops', async () => {
    const f = db('alice');
    await assertFails(setDoc(doc(f, 'shops/s1/other/x'), { a: 1 }));
    await assertFails(deleteDoc(doc(f, 'shops/s1/devices/gone')));
    await assertFails(deleteDoc(doc(f, 'shops/s1')));
    await assertFails(setDoc(doc(f, 'shops/s1/devices/fake'), device(SECRET)));
  });

  // The JS SDK always writes whole numbers as ints, but React Native Firebase sends
  // increment() results as doubles, so write a real double through the emulator's REST API.
  it('a member may write a whole-number double qty; a fractional double is refused', async () => {
    const host = env.emulators.firestore!;
    const token = (uid: string) =>
      ['{"alg":"none"}', JSON.stringify({ user_id: uid, sub: uid })]
        .map((x) => Buffer.from(x).toString('base64url'))
        .join('.') + '.';
    const patch = async (uid: string, qty: number) =>
      (
        await fetch(
          `http://${host.host}:${host.port}/v1/projects/demo-medstock/databases/(default)/documents/shops/s1/batches/b1?updateMask.fieldPaths=qty`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token(uid)}` },
            body: JSON.stringify({ fields: { qty: { doubleValue: qty } } }),
          },
        )
      ).status;
    expect(await patch('alice', 9)).toBe(200); // JSON 9 is sent as doubleValue 9
    expect(await patch('alice', -1)).toBe(200);
    expect(await patch('alice', 9.5)).toBe(403);
    expect(await patch('bob', 9)).toBe(403);
  });

  it('batch qty must stay an integer; increments are allowed, deletes are not', async () => {
    const f = db('alice');
    await assertSucceeds(updateDoc(doc(f, 'shops/s1/batches/b1'), { qty: increment(-1) }));
    await assertSucceeds(updateDoc(doc(f, 'shops/s1/batches/b1'), { qty: increment(-5) }));
    await assertFails(updateDoc(doc(f, 'shops/s1/batches/b1'), { qty: 1.5 }));
    await assertFails(updateDoc(doc(f, 'shops/s1/batches/b1'), { qty: increment(0.5) }));
    await assertFails(setDoc(doc(f, 'shops/s1/batches/b3'), { ...batch, qty: '3' }));
    await assertFails(deleteDoc(doc(f, 'shops/s1/batches/b1')));
    await assertFails(updateDoc(doc(db('bob'), 'shops/s1/batches/b1'), { qty: increment(-1) }));
  });

  it('device updates are limited to rename and remove; nobody un-removes a device', async () => {
    const f = db('alice');
    await assertSucceeds(updateDoc(doc(f, 'shops/s1/devices/gone'), { displayName: 'Renamed' }));
    await assertSucceeds(updateDoc(doc(f, 'shops/s1/devices/alice'), { displayName: 'Me' }));
    await assertFails(updateDoc(doc(f, 'shops/s1/devices/gone'), { removed: false }));
    await assertFails(updateDoc(doc(f, 'shops/s1/devices/gone'), { joinedAt: 9 }));
    await assertFails(updateDoc(doc(f, 'shops/s1/devices/gone'), { joinSecret: NEW_SECRET }));
    await assertFails(updateDoc(doc(f, 'shops/s1/devices/alice'), { removed: 'yes' }));
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'shops/s1/devices/bob'), device(SECRET)),
    );
    await assertSucceeds(updateDoc(doc(f, 'shops/s1/devices/bob'), { removed: true }));
  });

  it('events are append-only', async () => {
    const f = db('alice');
    await assertSucceeds(setDoc(doc(f, 'shops/s1/events/e2'), { batchId: 'b1', delta: -1 }));
    await assertFails(updateDoc(doc(f, 'shops/s1/events/e1'), { delta: 9 }));
    await assertFails(deleteDoc(doc(f, 'shops/s1/events/e1')));
  });
});

describe('joining', () => {
  it('creating devices/{uid} with the shop secret joins the shop', async () => {
    const f = db('bob');
    await assertSucceeds(setDoc(doc(f, 'shops/s1/devices/bob'), device(SECRET)));
    await assertSucceeds(getDoc(doc(f, 'shops/s1/batches/b1')));
  });

  it('a wrong secret, another uid, a missing shop or a removed flag is denied', async () => {
    const f = db('bob');
    await assertFails(setDoc(doc(f, 'shops/s1/devices/bob'), device('wrong'.repeat(5))));
    await assertFails(setDoc(doc(f, 'shops/s1/devices/carol'), device(SECRET)));
    await assertFails(setDoc(doc(f, 'shops/nope/devices/bob'), device(SECRET)));
    await assertFails(
      setDoc(doc(f, 'shops/s1/devices/bob'), { displayName: 'B', joinSecret: SECRET }),
    );
  });

  it('after rotating the secret old devices stay valid and only new joins need the new one', async () => {
    await assertSucceeds(updateDoc(doc(db('alice'), 'shops/s1'), { joinSecret: NEW_SECRET }));
    await assertSucceeds(getDoc(doc(db('alice'), 'shops/s1/batches/b1')));
    await assertFails(setDoc(doc(db('bob'), 'shops/s1/devices/bob'), device(SECRET)));
    await assertSucceeds(setDoc(doc(db('bob'), 'shops/s1/devices/bob'), device(NEW_SECRET)));
  });

  it('a short join secret is rejected', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'shops/s1'), { joinSecret: 'short' }));
  });
});

describe('creating a shop', () => {
  it('succeeds in one batch with the creator device and seed data', async () => {
    const f = db('carol');
    const b = writeBatch(f);
    b.set(doc(f, 'shops/s2'), { name: 'New', joinSecret: SECRET });
    b.set(doc(f, 'shops/s2/devices/carol'), device(SECRET));
    b.set(doc(f, 'shops/s2/categories/c1'), { name: 'Antibiotics', order: 0, lastCheckedAt: null });
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(f, 'shops/s2')));
  });

  it('fails without the creator device, or over an existing shop', async () => {
    const f = db('carol');
    await assertFails(setDoc(doc(f, 'shops/s3'), { name: 'Lonely', joinSecret: SECRET }));
    const b = writeBatch(f);
    b.set(doc(f, 'shops/s1'), { name: 'Hijack', joinSecret: NEW_SECRET });
    b.set(doc(f, 'shops/s1/devices/carol'), device(NEW_SECRET));
    await assertFails(b.commit());
  });
});
