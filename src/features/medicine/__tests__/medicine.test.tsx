import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Repos } from '@/data/repositories';
import { emptyDraft } from '@/domain/draft';
import type { Batch, Category, Medicine } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import { tokens } from '@/ui';
import MedicineRoute from '../../../../app/medicine/[id]';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const routes = (repos: Repos) => ({
  _layout: () => (
    <ToastProvider>
      <AppShell repos={repos} />
    </ToastProvider>
  ),
  index: () => null,
  'medicine/[id]': MedicineRoute,
});

async function seed() {
  let t = new Date(2026, 10, 4, 12).getTime();
  const repos = createMemoryRepos(() => t++);
  const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Ravi');
  let cats: Category[] = [];
  repos.inventory.watchCategories(shopId, (c) => (cats = c))();
  const draft = (batchNo: string, month: number, year: number, qty: number) => ({
    ...emptyDraft('manual'),
    medicineName: 'Dolo',
    companyName: 'Micro Labs',
    categoryId: cats[0].id,
    unit: 'carton' as const,
    batchNo,
    expiry: { year, month },
    qty,
  });
  // Added out of order: the screen must sort by expiry.
  await repos.inventory.saveIntake(shopId, [draft('H2', 7, 2027, 3)], null, deviceId);
  await repos.inventory.saveIntake(
    shopId,
    [draft('B1', 11, 2026, 2)],
    { supplier: 'Raj Pharma', billNo: '4471', billDate: '2026-11-04', scannedBy: deviceId },
    deviceId,
  );
  let meds: Medicine[] = [];
  repos.inventory.watchMedicines(shopId, (m) => (meds = m))();
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Ravi' }));
  return { repos, shopId, deviceId, medId: meds[0].id };
}
const liveQty = (repos: Repos, shopId: string) => {
  let b: Batch[] = [];
  repos.inventory.watchLiveBatches(shopId, (x) => (b = x))();
  return Object.fromEntries(b.map((x) => [x.batchNo, x.qty]));
};

beforeEach(() => {
  mockStore.clear();
  jest.useFakeTimers({
    now: new Date(2026, 10, 6, 10),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const open = async () => {
  const s = await seed();
  await renderRouter(routes(s.repos), { initialUrl: `/medicine/${s.medId}` });
  await screen.findByRole('header', { name: 'Dolo' });
  return s;
};

describe('medicine screen', () => {
  it('shows the strip', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'In stock 5' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Batches 2' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next expiry Nov 2026' })).toBeOnTheScreen();
  });

  it('lists live batches oldest first with bill and expiry rows', async () => {
    await open();
    const heads = screen.getAllByText(/^Batch /).map((n) => n.props.children);
    expect(heads.join('')).toMatch(/B1.*2 cartons[\s\S]*H2.*3 cartons/);
    expect(screen.getByText('Raj Pharma · #4471 · 4 Nov')).toBeOnTheScreen();
    expect(screen.getByText('Added by hand')).toBeOnTheScreen();
    expect(screen.getByText('From bill')).toBeOnTheScreen();
    expect(screen.getByText('Source')).toBeOnTheScreen();
    expect(screen.getByText('in 24 days')).toBeOnTheScreen();
    expect(screen.getByText('in 9 months')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Sold 1' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Edit count' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Returned' })).toHaveLength(2);
  });

  it('an expired batch says so, makes Returned the main action and blocks Sold 1', async () => {
    const s = await seed();
    const draft = {
      ...emptyDraft('manual'),
      medicineName: 'Dolo',
      companyName: 'Micro Labs',
      unit: 'carton' as const,
      batchNo: 'X9',
      expiry: { year: 2026, month: 10 }, // ended 31 Oct: 6 days before 6 Nov
      qty: 1,
    };
    let cats: Category[] = [];
    s.repos.inventory.watchCategories(s.shopId, (c) => (cats = c))();
    await s.repos.inventory.saveIntake(
      s.shopId,
      [{ ...draft, categoryId: cats[0].id }],
      null,
      s.deviceId,
    );
    await renderRouter(routes(s.repos), { initialUrl: `/medicine/${s.medId}` });
    expect(
      await screen.findByText('Expired 6 days ago — return it or take it off the shelf'),
    ).toBeOnTheScreen();
    const [sold] = screen.getAllByRole('button', { name: 'Sold 1' });
    expect(sold).toBeDisabled();
    expect(sold.props.accessibilityHint).toBe("Expired medicine can't be sold");
    const [returned] = screen.getAllByRole('button', { name: 'Returned' });
    expect(StyleSheet.flatten(returned.props.style).backgroundColor).toBe(tokens.color.primary);
    await fireEvent.press(sold);
    expect(liveQty(s.repos, s.shopId).X9).toBe(1);
  });

  it('Sold 1 lowers the quantity and toasts', async () => {
    const { repos, shopId } = await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Sold 1' })[0]);
    // Toast plus the new history line.
    expect(await screen.findAllByText('Sold 1 carton')).toHaveLength(2);
    expect(liveQty(repos, shopId)).toEqual({ B1: 1, H2: 3 });
    expect(await screen.findByText('Batch B1 · 1 carton')).toBeOnTheScreen();
  });

  it('Edit count saves an absolute count', async () => {
    const { repos, shopId } = await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Edit count' })[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Increase' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Batch H2 · 4 cartons')).toBeOnTheScreen();
    expect(liveQty(repos, shopId)).toEqual({ B1: 2, H2: 4 });
  });

  it('Edit count to 0 asks first: Cancel keeps the count, Close batch closes it', async () => {
    const { repos, shopId } = await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Edit count' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('This closes batch B1.')).toBeOnTheScreen();
    await fireEvent.press(
      within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(liveQty(repos, shopId)).toEqual({ B1: 2, H2: 3 });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close batch' }));
    await act(async () => {});
    expect(liveQty(repos, shopId)).toEqual({ H2: 3 });
    expect(screen.queryByText('Batch B1 · 2 cartons')).toBeNull();
  });

  it('Returned asks first, then removes the card', async () => {
    const { repos, shopId } = await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Returned' })[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Mark batch B1 as returned?' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(liveQty(repos, shopId)).toEqual({ B1: 2, H2: 3 });
    await fireEvent.press(screen.getAllByRole('button', { name: 'Returned' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Mark returned' }));
    expect(await screen.findByText('Marked returned')).toBeOnTheScreen();
    expect(screen.queryByText('Batch B1 · 2 cartons')).toBeNull();
    expect(liveQty(repos, shopId)).toEqual({ H2: 3 });
  });

  it('shows the latest events with device names', async () => {
    await open();
    expect(await screen.findByText('+2 cartons from bill #4471')).toBeOnTheScreen();
    expect(screen.getByText('+3 cartons added')).toBeOnTheScreen();
    expect(screen.getAllByText('4 Nov · Ravi')).toHaveLength(2);
  });

  it('keeps the bill on history after the batch is closed', async () => {
    const { repos, shopId } = await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Returned' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Mark returned' }));
    await screen.findByText('Marked returned');
    expect(screen.getByText('+2 cartons from bill #4471')).toBeOnTheScreen();
    expect(liveQty(repos, shopId)).toEqual({ H2: 3 });
  });

  it('toasts friendly copy, never the raw error, and shows meta and a plain Back', async () => {
    const { repos } = await open();
    jest.spyOn(repos.inventory, 'sellOne').mockRejectedValue(new Error('no stock to sell'));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Sold 1' })[0]);
    expect(
      await screen.findByText("Couldn't save. Check the connection and try again."),
    ).toBeOnTheScreen();
    expect(screen.queryByText('no stock to sell')).toBeNull();
    expect(screen.getByText('Micro Labs · counted in cartons')).toBeOnTheScreen();
    // Opened from somewhere other than its folder (an alert list, Home search).
    expect(screen.getByRole('button', { name: 'Back, Back' })).toBeOnTheScreen();
  });

  it('names the folder on Back only when opened from that folder', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: `/medicine/${s.medId}?from=folder` });
    expect(await screen.findByRole('button', { name: 'Back, Antibiotics' })).toBeOnTheScreen();
  });

  it('Add batch opens manual intake for this medicine', async () => {
    const { medId } = await open();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: '+ Add batch' }));
    expect(push).toHaveBeenCalledWith(`/intake/manual?medicineId=${medId}`);
  });

  it('says when the medicine is unknown', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/medicine/nope' });
    expect(await screen.findByText('Medicine not found')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Dolo' })).toBeNull();
  });
});
