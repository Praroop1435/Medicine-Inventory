import { router } from 'expo-router';
import { useState } from 'react';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Repos } from '@/data/repositories';
import { applyMatch, emptyDraft, type DraftBatch } from '@/domain/draft';
import type { Batch, Category, Company, Medicine } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import { Button, T } from '@/ui';
import { useIntake, useSaveDrafts, type BillHeader } from '../IntakeContext';
import ManualRoute from '../../../../app/intake/manual';
import ReviewRoute from '../../../../app/intake/review';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const BILL: BillHeader = { supplier: 'Raj Pharma', billNo: '4471', billDate: '2026-11-04' };
let pending: { drafts: DraftBatch[]; bill?: BillHeader } = { drafts: [] };

/** Stands in for a scan/voice/bulk adapter: hands drafts to the pipeline and opens review. */
function Start() {
  const { setDrafts } = useIntake();
  const saveDrafts = useSaveDrafts();
  const [err, setErr] = useState('');
  return (
    <>
      <Button
        label="Open review"
        onPress={() => {
          setDrafts(pending.drafts, pending.bill);
          router.push('/intake/review');
        }}
      />
      <Button
        label="Force save"
        onPress={() => saveDrafts(pending.drafts, null).catch((e: Error) => setErr(e.message))}
      />
      {err ? <T>{err}</T> : null}
    </>
  );
}

const routes = (repos: Repos) => ({
  _layout: () => (
    <ToastProvider>
      <AppShell repos={repos} />
    </ToastProvider>
  ),
  index: Start,
  'intake/review': ReviewRoute,
  'intake/manual': ManualRoute,
});

async function seed() {
  let t = 1;
  const repos = createMemoryRepos(() => t++);
  const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Ravi');
  let cats: Category[] = [];
  repos.inventory.watchCategories(shopId, (c) => (cats = c))();
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;
  await repos.inventory.saveIntake(
    shopId,
    [
      ['Azithral 500', 'Alembic', 'Antibiotics', 'carton', 'OLD1'] as const,
      ['Benadryl syrup 100 ml', 'J&J', 'Cough syrups', 'bottle', 'OLD2'] as const,
    ].map(([medicineName, companyName, c, unit, batchNo]) => ({
      ...emptyDraft('manual'),
      medicineName,
      companyName,
      categoryId: cat(c),
      unit,
      batchNo,
      expiry: { year: 2027, month: 1 },
      qty: 1,
    })),
    null,
    deviceId,
  );
  let meds: Medicine[] = [];
  let cos: Company[] = [];
  repos.inventory.watchMedicines(shopId, (m) => (meds = m))();
  repos.inventory.watchCompanies(shopId, (c) => (cos = c))();
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Ravi' }));
  const draft = (p: Partial<DraftBatch>): DraftBatch =>
    applyMatch({ ...emptyDraft('scan'), ...p }, meds, cos);
  return { repos, shopId, deviceId, cat, draft, meds };
}

const liveBatches = (repos: Repos, shopId: string) => {
  let b: Batch[] = [];
  repos.inventory.watchLiveBatches(shopId, (x) => (b = x))();
  return b;
};

/** The owner's mockup: six rows, expiry unsure on one, quantity unsure on another. */
function sixDrafts(s: Awaited<ReturnType<typeof seed>>) {
  const nov = { year: 2026, month: 11 };
  const fresh = (medicineName: string, batchNo: string) =>
    s.draft({
      medicineName,
      companyName: 'Cipla',
      categoryId: s.cat('Tablets (general)'),
      unit: 'strip',
      batchNo,
      expiry: { year: 2028, month: 3 },
      qty: 10,
    });
  return [
    s.draft({
      medicineName: 'Azithral 500',
      batchNo: 'AZ88',
      expiry: nov,
      qty: 2,
      uncertain: ['expiry'],
    }),
    s.draft({
      medicineName: 'Benadryl syrup 100 ml',
      batchNo: 'K2231',
      expiry: nov,
      qty: 8,
      uncertain: ['qty'],
    }),
    fresh('Ciplox 500', 'C1'),
    fresh('Okacet 10', 'C2'),
    fresh('Montair 10', 'C3'),
    fresh('Novamox 250', 'C4'),
  ];
}

async function openReview(drafts: DraftBatch[], bill?: BillHeader) {
  pending = { drafts, bill };
  await fireEvent.press(await screen.findByRole('button', { name: 'Open review' }));
  await screen.findByRole('header', { name: 'Check bill' });
}

async function start() {
  const s = await seed();
  await renderRouter(routes(s.repos), { initialUrl: '/' });
  return s;
}

beforeEach(() => mockStore.clear());
afterEach(() => jest.restoreAllMocks());

type Fiber = { memoizedProps?: { onPress?: () => void }; return: Fiber | null };
/** Two taps in one frame, before React re-renders the button as disabled. */
async function doubleTap(el: unknown) {
  let f: Fiber | null = (el as { unstable_fiber: Fiber }).unstable_fiber;
  while (f && typeof f.memoizedProps?.onPress !== 'function') f = f.return;
  const press = f!.memoizedProps!.onPress!;
  await act(async () => {
    press();
    press();
  });
}

const saveButton = () => screen.getByRole('button', { name: /^(Confirm|Save) / });
const cards = () => screen.getAllByTestId('review-card');

describe('review screen', () => {
  it('counts what needs a look and unlocks save once each amber field is confirmed or edited', async () => {
    const s = await start();
    await openReview(sixDrafts(s), BILL);
    expect(screen.getByText('6 items read · 2 need a look')).toBeOnTheScreen();
    expect(screen.getByText('Raj Pharma · Bill #4471 · 2026-11-04')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 2 fields to save');
    expect(saveButton()).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Looks right: expiry' }));
    expect(saveButton()).toHaveAccessibleName('Confirm 1 field to save');

    // Re-typing the same quantity is not a confirmation.
    const qty = within(cards()[1]).getByLabelText('Quantity');
    await fireEvent.changeText(qty, '8');
    expect(saveButton()).toHaveAccessibleName('Confirm 1 field to save');
    await fireEvent.changeText(qty, '9');

    expect(screen.getByText('6 items read')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Save 6 items');
    expect(saveButton()).toBeEnabled();
  });

  it('marks unsure fields amber with what to check', async () => {
    const s = await start();
    await openReview(sixDrafts(s));
    expect(screen.getByText('Check expiry')).toBeOnTheScreen();
    expect(screen.getByText('Check quantity')).toBeOnTheScreen();
    const boxes = within(cards()[0]).getAllByTestId('field-box');
    const amber = boxes.filter((b) => b.props.style.borderColor === '#d97706');
    expect(amber).toHaveLength(1);
  });

  it('tags an unmatched row New and needs category and unit; a matched row shows its category', async () => {
    const s = await start();
    await openReview([
      s.draft({
        medicineName: 'Azithral 500',
        batchNo: 'AZ88',
        expiry: { year: 2027, month: 5 },
        qty: 2,
      }),
      s.draft({
        medicineName: 'Zincovit',
        companyName: 'Apex',
        batchNo: 'Z1',
        expiry: { year: 2027, month: 5 },
        qty: 3,
      }),
    ]);
    const [matched, fresh] = cards();
    expect(within(matched).queryByText('New')).toBeNull();
    expect(within(matched).getByText('Antibiotics')).toBeOnTheScreen();
    expect(within(matched).queryByRole('button', { name: 'Vitamins' })).toBeNull();

    expect(within(fresh).getByText('New')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 2 fields to save');
    await fireEvent.press(within(fresh).getByRole('button', { name: 'Vitamins' }));
    await fireEvent.press(within(fresh).getByRole('button', { name: 'Strip' }));
    expect(saveButton()).toHaveAccessibleName('Save 2 items');
  });

  it('re-matches on every rename: a matched row renamed to an unknown medicine becomes New', async () => {
    const s = await start();
    await openReview([
      s.draft({
        medicineName: 'Azithral 500',
        batchNo: 'AZ88',
        expiry: { year: 2027, month: 5 },
        qty: 2,
      }),
    ]);
    expect(saveButton()).toHaveAccessibleName('Save 1 item');
    await fireEvent.changeText(screen.getByLabelText('Medicine name'), 'Zyx 10');
    expect(screen.getByText('New')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Antibiotics' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Carton' })).toBeOnTheScreen();
    // The company came from the lost match, so it must be confirmed too.
    expect(screen.getByLabelText('Company').props.value).toBe('Alembic');
    expect(screen.getByText('Check company')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 3 fields to save');
    expect(saveButton()).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Looks right: company' }));
    expect(saveButton()).toHaveAccessibleName('Confirm 2 fields to save');
  });

  it('matches drafts handed in by an adapter, dropping doubts the match settles', async () => {
    await start();
    await openReview([
      {
        ...emptyDraft('scan'),
        medicineName: 'Azithral 500',
        companyName: 'Alembc',
        batchNo: 'AZ88',
        expiry: { year: 2027, month: 5 },
        qty: 2,
        uncertain: ['companyName'],
      },
    ]);
    expect(screen.queryByText('New')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Antibiotics' })).toBeNull();
    expect(screen.getByText('Antibiotics')).toBeOnTheScreen();
    expect(screen.getByText('Alembic')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Looks right: company' })).toBeNull();
    expect(saveButton()).toHaveAccessibleName('Save 1 item');
  });

  it('the save path refuses drafts a human has not confirmed', async () => {
    const s = await start();
    const spy = jest.spyOn(s.repos.inventory, 'saveIntake');
    pending = { drafts: sixDrafts(s) };
    await fireEvent.press(screen.getByRole('button', { name: 'Force save' }));
    expect(await screen.findByText('Some fields still need a look')).toBeOnTheScreen();
    expect(spy).not.toHaveBeenCalled();
  });

  it('a double tap on save writes once', async () => {
    const s = await start();
    const spy = jest
      .spyOn(s.repos.inventory, 'saveIntake')
      .mockImplementation(() => new Promise<void>((r) => setTimeout(r, 20)));
    await openReview(sixDrafts(s).map((d) => ({ ...d, uncertain: [] })));
    const b = screen.getByRole('button', { name: 'Save 6 items' });
    await doubleTap(b);
    expect(await screen.findByText('Saved 6 items')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('blocks save on an expiry it cannot read', async () => {
    const s = await start();
    await openReview([
      s.draft({
        medicineName: 'Azithral 500',
        batchNo: 'AZ88',
        expiry: { year: 2027, month: 5 },
        qty: 2,
      }),
    ]);
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '13/26');
    expect(screen.getByText('Check expiry')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 1 field to save');
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '11/26');
    expect(saveButton()).toHaveAccessibleName('Save 1 item');
  });

  it('removes a row', async () => {
    const s = await start();
    await openReview(sixDrafts(s));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Azithral 500' }));
    expect(screen.getByText('5 items read · 1 needs a look')).toBeOnTheScreen();
  });

  it('saves all rows in one call, then goes back with a toast', async () => {
    const s = await start();
    const spy = jest.spyOn(s.repos.inventory, 'saveIntake');
    const drafts = sixDrafts(s).map((d) => ({ ...d, uncertain: [] }));
    await openReview(drafts, BILL);
    await fireEvent.press(screen.getByRole('button', { name: 'Save 6 items' }));
    expect(await screen.findByText('Saved 6 items')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(s.shopId, drafts, { ...BILL, scannedBy: 'Ravi' }, s.deviceId);
    expect(screen.getByRole('button', { name: 'Open review' })).toBeOnTheScreen();
    expect(liveBatches(s.repos, s.shopId)).toHaveLength(8);
  });

  it('keeps the rows and says why when saving fails', async () => {
    const s = await start();
    jest.spyOn(s.repos.inventory, 'saveIntake').mockRejectedValue(new Error('Offline and full'));
    await openReview(sixDrafts(s).map((d) => ({ ...d, uncertain: [] })));
    await fireEvent.press(screen.getByRole('button', { name: 'Save 6 items' }));
    expect(await screen.findByText('Offline and full')).toBeOnTheScreen();
    expect(screen.getByText('6 items read')).toBeOnTheScreen();
    expect(saveButton()).toBeEnabled();
  });
});

describe('manual entry', () => {
  it('suggests existing medicines and fills a picked one', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/intake/manual' });
    await fireEvent.changeText(await screen.findByLabelText('Medicine name'), 'azith');
    await fireEvent.press(screen.getByRole('button', { name: 'Azithral 500' }));
    expect(screen.getByLabelText('Medicine name').props.value).toBe('Azithral 500');
    expect(screen.getByText('Antibiotics')).toBeOnTheScreen();
    expect(screen.getByText('Alembic')).toBeOnTheScreen();
    expect(screen.queryByText('New')).toBeNull();
  });

  it('prefills from medicineId', async () => {
    const s = await seed();
    const med = s.meds.find((m) => m.name === 'Benadryl syrup 100 ml')!;
    await renderRouter(routes(s.repos), { initialUrl: `/intake/manual?medicineId=${med.id}` });
    expect((await screen.findByLabelText('Medicine name')).props.value).toBe(
      'Benadryl syrup 100 ml',
    );
    expect(screen.getByText('Cough syrups')).toBeOnTheScreen();
  });

  it('Save & next saves one row and clears only name, batch, expiry and quantity', async () => {
    const s = await seed();
    const spy = jest.spyOn(s.repos.inventory, 'saveIntake');
    await renderRouter(routes(s.repos), { initialUrl: '/intake/manual' });
    const next = () => screen.getByRole('button', { name: 'Save & next' });
    await fireEvent.changeText(await screen.findByLabelText('Medicine name'), 'Zincovit');
    expect(next()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Company'), 'Apex');
    await fireEvent.press(screen.getByRole('button', { name: 'Vitamins' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Strip' }));
    await fireEvent.changeText(screen.getByLabelText('Batch'), 'Z1');
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '11/27');
    await fireEvent.changeText(screen.getByLabelText('Quantity'), '10+1');
    await fireEvent.press(next());

    expect(await screen.findByText('Saved Zincovit')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toHaveLength(1);
    expect(spy.mock.calls[0][2]).toBeNull();
    const z = liveBatches(s.repos, s.shopId).find((b) => b.batchNo === 'Z1')!;
    expect(z).toMatchObject({ qty: 11, expiry: { year: 2027, month: 11 } });

    for (const f of ['Medicine name', 'Batch', 'Expiry', 'Quantity'])
      expect(screen.getByLabelText(f).props.value).toBe('');
    expect(screen.getByLabelText('Company').props.value).toBe('Apex');
    expect(screen.getByRole('button', { name: 'Vitamins' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Strip' })).toBeSelected();
  });

  it('a double tap on Save & next writes once', async () => {
    const s = await seed();
    const med = s.meds.find((m) => m.name === 'Azithral 500')!;
    const spy = jest
      .spyOn(s.repos.inventory, 'saveIntake')
      .mockImplementation(() => new Promise<void>((r) => setTimeout(r, 20)));
    await renderRouter(routes(s.repos), { initialUrl: `/intake/manual?medicineId=${med.id}` });
    await fireEvent.changeText(await screen.findByLabelText('Batch'), 'AZ90');
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '11/27');
    await fireEvent.changeText(screen.getByLabelText('Quantity'), '2');
    const b = screen.getByRole('button', { name: 'Save & next' });
    await doubleTap(b);
    expect(await screen.findByText('Saved Azithral 500')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
