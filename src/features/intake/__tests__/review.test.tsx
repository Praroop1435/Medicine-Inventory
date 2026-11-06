import { router } from 'expo-router';
import { useState } from 'react';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Repos } from '@/data/repositories';
import { applyMatch, canSave, emptyDraft, type DraftBatch } from '@/domain/draft';
import { realBillMlkitDump } from '@/services/ocr/__fixtures__/real-bill-mlkit-dump';
import { parseBillText } from '@/services/ocr/billParser';
import type { Batch, Category, Company, Medicine } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import { Button, T, tokens } from '@/ui';
import { typeExpiry } from '../components/ReviewCard';
import { confirmRow, fillNew, useIntake, useSaveDrafts, type BillHeader } from '../IntakeContext';
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

/** Stands in for the scan screen: the review is pushed on top of it. */
function ScanStub() {
  const { setDrafts } = useIntake();
  return (
    <Button
      label="Scan stub: read bill"
      onPress={() => {
        setDrafts(pending.drafts, pending.bill);
        router.push('/intake/review');
      }}
    />
  );
}

const routes = (repos: Repos) => ({
  _layout: () => (
    <ToastProvider>
      <AppShell repos={repos} />
    </ToastProvider>
  ),
  index: Start,
  'intake/scan': ScanStub,
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
  await screen.findByRole('header', { name: TITLES[drafts[0].source] });
}

const TITLES = {
  scan: 'Check bill',
  voice: 'Check what you said',
  manual: 'Add stock',
  bulk: 'Check import',
} as const;

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
/** Opens a collapsed row's edit form. */
const expand = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name: `Edit ${name}` }));
/** Picks an option from a Select: tap the field, then the row in its sheet. */
async function pick(label: string, option: string) {
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${label}, `) }));
  await fireEvent.press(within(screen.getByTestId('sheet')).getByRole('button', { name: option }));
}
const select = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`^${label}, `) }).props.accessibilityLabel;

describe('review screen', () => {
  it('counts rows, not fields, and unlocks save once every row is confirmed', async () => {
    const s = await start();
    await openReview(sixDrafts(s), BILL);
    expect(screen.getByText('Raj Pharma · Bill #4471 · 2026-11-04')).toBeOnTheScreen();
    expect(screen.getByText('4 of 6 confirmed')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 2 more rows');
    expect(saveButton()).toBeDisabled();

    // One tap confirms the whole row.
    await fireEvent.press(screen.getByRole('button', { name: 'Looks right, Azithral 500' }));
    expect(saveButton()).toHaveAccessibleName('Confirm 1 more row');

    // Re-typing the same quantity is not a confirmation.
    await expand('Benadryl syrup 100 ml');
    const qty = within(cards()[0]).getByLabelText('Quantity');
    await fireEvent.changeText(qty, '8');
    expect(saveButton()).toHaveAccessibleName('Confirm 1 more row');
    await fireEvent.changeText(qty, '9');

    expect(screen.getByText('6 of 6 confirmed')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Save 6 items');
    expect(saveButton()).toBeEnabled();
  });

  it.each(Object.entries(TITLES))('titles a %s review "%s"', async (source, title) => {
    const s = await start();
    await openReview([{ ...sixDrafts(s)[2], source: source as DraftBatch['source'] }]);
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
  });

  it('rows start collapsed with what was read and where they stand', async () => {
    const s = await start();
    await openReview(sixDrafts(s));
    expect(screen.queryAllByTestId('review-card')).toHaveLength(0);
    const rows = screen.getAllByTestId('review-row');
    expect(rows).toHaveLength(6);
    const az = within(rows[0]);
    expect(az.getByText('Batch AZ88 · Exp Nov 2026 · Qty 2')).toBeOnTheScreen();
    expect(az.getByText('Alembic')).toBeOnTheScreen();
    // One signal per row: the amber line and its button, no extra "Check" pill or tick.
    expect(az.getByText('Check expiry')).toBeOnTheScreen();
    expect(az.getByRole('button', { name: 'Looks right, Azithral 500' })).toBeOnTheScreen();
    expect(az.queryByText('Check')).toBeNull();
    expect(az.queryByTestId('row-status-ok')).toBeNull();
    const ok = within(rows[2]);
    expect(ok.getByTestId('row-status-ok')).toBeOnTheScreen();
    expect(ok.queryByRole('button', { name: /^Looks right/ })).toBeNull();
    expect(ok.queryByRole('button', { name: 'Fix' })).toBeNull();
  });

  it('opens one row at a time, with amber fields to check', async () => {
    const s = await start();
    await openReview(sixDrafts(s));
    await expand('Azithral 500');
    expect(screen.getByText('Check expiry')).toBeOnTheScreen();
    const boxes = within(cards()[0]).getAllByTestId('field-box');
    const amber = boxes.filter((b) => b.props.style.borderColor === tokens.color.amber);
    expect(amber).toHaveLength(1);
    await expand('Benadryl syrup 100 ml');
    expect(cards()).toHaveLength(1);
    expect(within(cards()[0]).getByLabelText('Medicine name').props.value).toBe(
      'Benadryl syrup 100 ml',
    );
    await fireEvent.press(within(cards()[0]).getByRole('button', { name: 'Done' }));
    expect(screen.queryAllByTestId('review-card')).toHaveLength(0);
  });

  it('a row missing its folder and unit says Fix, which opens it; pickers are select fields', async () => {
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
    const fresh = within(screen.getAllByTestId('review-row')[1]);
    expect(fresh.getByText('Add folder, unit')).toBeOnTheScreen();
    // The Fix button is the only "Fix" on the row.
    expect(fresh.getAllByText('Fix')).toHaveLength(1);
    expect(fresh.queryByTestId('row-status-ok')).toBeNull();
    expect(saveButton()).toHaveAccessibleName('Confirm 1 more row');
    await fireEvent.press(fresh.getByRole('button', { name: 'Fix' }));
    expect(screen.getByText('New medicine · pick category and unit')).toBeOnTheScreen();
    expect(select('Category')).toBe('Category, Pick a folder');
    await pick('Category', 'Vitamins');
    await pick('Unit', 'Strip');
    expect(select('Category')).toBe('Category, Vitamins');
    expect(saveButton()).toHaveAccessibleName('Save 2 items');

    await expand('Azithral 500');
    const matched = within(cards()[0]);
    expect(matched.queryByText('New medicine · pick category and unit')).toBeNull();
    expect(matched.getByText('Antibiotics')).toBeOnTheScreen();
    expect(matched.queryByRole('button', { name: /^Category, / })).toBeNull();
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
    await expand('Azithral 500');
    await fireEvent.changeText(screen.getByLabelText('Medicine name'), 'Zyx 10');
    expect(screen.getByText('New medicine · pick category and unit')).toBeOnTheScreen();
    expect(select('Category')).toBe('Category, Pick a folder');
    expect(select('Unit')).toBe('Unit, Pick a unit');
    // The company came from the lost match, so it must be confirmed too.
    expect(screen.getByLabelText('Company').props.value).toBe('Alembic');
    expect(screen.getByText('Check company')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 1 more row');
    expect(saveButton()).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Looks right: company' }));
    expect(screen.queryByText('Check company')).toBeNull();
    expect(saveButton()).toBeDisabled();
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
    expect(screen.getByText('Alembic')).toBeOnTheScreen();
    expect(screen.getByTestId('row-status-ok')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Save 1 item');
    await expand('Azithral 500');
    expect(screen.getByText('Antibiotics')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Looks right: company' })).toBeNull();
  });

  it('a company read off the bill that the shop already has is not amber', async () => {
    const s = await start();
    await openReview([
      {
        ...emptyDraft('scan'),
        medicineName: 'Zincovit',
        companyName: 'ALEMBIC',
        categoryId: s.cat('Vitamins'),
        unit: 'strip',
        batchNo: 'Z1',
        expiry: { year: 2027, month: 5 },
        qty: 2,
        uncertain: ['companyName', 'batchNo'],
      },
    ]);
    // Only the batch is left to check; a company the shop doesn't know would stay amber.
    expect(screen.getByText('Check batch')).toBeOnTheScreen();
  });

  it('the save path refuses drafts a human has not confirmed', async () => {
    const s = await start();
    const spy = jest.spyOn(s.repos.inventory, 'saveIntake');
    pending = { drafts: sixDrafts(s) };
    await fireEvent.press(screen.getByRole('button', { name: 'Force save' }));
    expect(await screen.findByText('Confirm the amber fields to save')).toBeOnTheScreen();
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
    await expand('Azithral 500');
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '13/26');
    expect(screen.getByText('Check expiry')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 1 more row');
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '11/26');
    expect(saveButton()).toHaveAccessibleName('Save 1 item');
  });

  it('removes a row from its open form', async () => {
    const s = await start();
    await openReview(sixDrafts(s));
    await expand('Azithral 500');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Azithral 500' }));
    expect(screen.getByText('4 of 5 confirmed')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 1 more row');
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

  it('saving a scanned bill goes Home, past the scan screen, with the toast', async () => {
    const s = await start();
    pending = { drafts: sixDrafts(s).map((d) => ({ ...d, uncertain: [] })), bill: BILL };
    await act(async () => router.push('/intake/scan'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Scan stub: read bill' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Save 6 items' }));
    expect(await screen.findByText('Saved 6 items')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open review' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Scan stub: read bill' })).toBeNull();
    expect(screen).toHavePathname('/');
  });

  it('keeps the rows and says why when saving fails', async () => {
    const s = await start();
    jest
      .spyOn(s.repos.inventory, 'saveIntake')
      .mockRejectedValue(new Error('FIRESTORE (11.0) INTERNAL ASSERTION FAILED'));
    await openReview(sixDrafts(s).map((d) => ({ ...d, uncertain: [] })));
    await fireEvent.press(screen.getByRole('button', { name: 'Save 6 items' }));
    expect(
      await screen.findByText("Couldn't save. Check the connection and try again."),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/INTERNAL ASSERTION/)).toBeNull();
    expect(screen.getByText('6 of 6 confirmed')).toBeOnTheScreen();
    expect(saveButton()).toBeEnabled();
  });

  it('the real 9-row bill: set folder and unit for all, one tap per row, then save', async () => {
    const s = await start();
    const { drafts, header } = parseBillText(realBillMlkitDump);
    await openReview(drafts, { supplier: '', billNo: '', billDate: '', ...header });
    expect(screen.getByText('SWASTIKAGENCIES · Bill #2185 · 02/11/26')).toBeOnTheScreen();
    expect(screen.getByText('0 of 9 confirmed')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Confirm 9 more rows');
    expect(screen.getByText('9 new medicines need a folder and unit')).toBeOnTheScreen();
    // Fix rows can't be waved through.
    expect(screen.queryAllByRole('button', { name: /^Looks right, / })).toHaveLength(0);
    await pick('Folder for all', 'Cough syrups');
    await pick('Unit for all', 'Bottle');
    expect(screen.queryByTestId('set-for-all')).toBeNull();
    // Companies the shop doesn't know yet stay amber to check.
    expect(screen.getAllByText(/^Check .*company/).length).toBeGreaterThan(0);
    const ticks = () => screen.queryAllByRole('button', { name: /^Looks right, / });
    expect(ticks()).toHaveLength(9);
    while (ticks().length) await fireEvent.press(ticks()[0]);
    expect(screen.getByText('9 of 9 confirmed')).toBeOnTheScreen();
    expect(saveButton()).toHaveAccessibleName('Save 9 items');
    expect(saveButton()).toBeEnabled();
    const spy = jest.spyOn(s.repos.inventory, 'saveIntake');
    await fireEvent.press(saveButton());
    expect(await screen.findByText('Saved 9 items')).toBeOnTheScreen();
    expect(spy.mock.calls[0][1].every((d) => d.categoryId === s.cat('Cough syrups'))).toBe(true);
  });
});

describe('row helpers', () => {
  const base = { ...emptyDraft('scan'), medicineName: 'X', companyName: 'Y', batchNo: 'B' };
  it('fillNew fills only what a new row is missing and leaves matched rows alone', () => {
    const missing = { ...base, unit: null, categoryId: null };
    const hasFolder = { ...base, categoryId: 'vit', unit: null };
    const matched = { ...base, matchedMedicineId: 'm1', categoryId: null };
    const out = [missing, hasFolder, matched].map((d) =>
      fillNew(d, { categoryId: 'anti', unit: 'bottle' }, [], []),
    );
    expect(out.map((d) => [d.categoryId, d.unit])).toEqual([
      ['anti', 'bottle'],
      ['vit', 'bottle'],
      [null, null],
    ]);
  });
  it('confirmRow clears every doubt, but not while something is missing', () => {
    const ok = {
      ...base,
      categoryId: 'c',
      unit: 'strip',
      expiry: { year: 2027, month: 1 },
      qty: 1,
    };
    const unsure = {
      ...ok,
      uncertain: ['expiry', 'qty', 'companyName'] as DraftBatch['uncertain'],
    };
    expect(confirmRow(unsure).uncertain).toEqual([]);
    expect(canSave([confirmRow(unsure)])).toBe(true);
    const broken = { ...unsure, unit: null };
    expect(confirmRow(broken).uncertain).toHaveLength(3);
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
    expect(screen.queryByText('New medicine · pick category and unit')).toBeNull();
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

  it('presets the category from categoryId', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), {
      initialUrl: `/intake/manual?categoryId=${s.cat('Vitamins')}`,
    });
    await fireEvent.changeText(await screen.findByLabelText('Medicine name'), 'Zincovit');
    expect(select('Category')).toBe('Category, Vitamins');
  });

  it('the category picker shows folder paths and adds a new top-level folder', async () => {
    const s = await seed();
    const dry = await s.repos.inventory.upsertCategory(s.shopId, {
      name: 'Dry',
      order: 0,
      lastCheckedAt: null,
      parentId: s.cat('Cough syrups'),
    });
    await renderRouter(routes(s.repos), { initialUrl: '/intake/manual' });
    await fireEvent.changeText(await screen.findByLabelText('Medicine name'), 'Zincovit');
    await fireEvent.press(screen.getByRole('button', { name: /^Category, / }));
    const sheet = within(screen.getByTestId('sheet'));
    expect(sheet.queryByRole('button', { name: 'Dry' })).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: 'Cough syrups › Dry' }));
    expect(select('Category')).toBe('Category, Cough syrups › Dry');

    await fireEvent.press(screen.getByRole('button', { name: /^Category, / }));
    await fireEvent.press(screen.getByRole('button', { name: '+ New folder' }));
    await fireEvent.changeText(screen.getByLabelText('Folder name'), 'Ayurveda');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Category, Ayurveda' })).toBeOnTheScreen();
    let cats: Category[] = [];
    s.repos.inventory.watchCategories(s.shopId, (c) => (cats = c))();
    expect(cats.find((c) => c.name === 'Ayurveda')).toMatchObject({ parentId: null });
    expect(cats.find((c) => c.id === dry)?.parentId).toBe(s.cat('Cough syrups'));
  });

  it('"+ Add unit" adds a custom unit to the shop and selects it', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/intake/manual' });
    await fireEvent.changeText(await screen.findByLabelText('Medicine name'), 'Zincovit');
    await fireEvent.press(screen.getByRole('button', { name: /^Unit, / }));
    await fireEvent.press(screen.getByRole('button', { name: '+ Add unit' }));
    await fireEvent.changeText(screen.getByLabelText('New unit'), ' Kit ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('button', { name: 'Unit, Kit' })).toBeOnTheScreen();
    let shop: import('@/domain/types').Shop | null = null;
    s.repos.shop.watchShop(s.shopId, (x) => (shop = x))();
    expect((shop as unknown as import('@/domain/types').Shop).units).toContain('kit');
  });

  it('pickers open a searchable sheet that keeps "+ New folder" / "+ Add unit" at the bottom', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/intake/manual' });
    await fireEvent.changeText(await screen.findByLabelText('Medicine name'), 'Zincovit');
    await fireEvent.press(screen.getByRole('button', { name: /^Unit, / }));
    const sheet = within(screen.getByTestId('sheet'));
    expect(sheet.getByRole('button', { name: '+ Add unit' })).toBeOnTheScreen();
    await fireEvent.changeText(sheet.getByLabelText('Search unit'), 'bot');
    expect(sheet.getByRole('button', { name: 'Bottle' })).toBeOnTheScreen();
    expect(sheet.queryByRole('button', { name: 'Strip' })).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: 'Bottle' }));
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(select('Unit')).toBe('Unit, Bottle');
  });

  it('expiry: number pad, MM/YY with the slash added, and says how it was read', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/intake/manual' });
    const expiry = await screen.findByLabelText('Expiry');
    expect(expiry.props.keyboardType).toBe('number-pad');
    expect(expiry.props.placeholder).toBe('MM/YY');
    expect(screen.getByLabelText('Quantity').props.keyboardType).toBe('number-pad');
    await fireEvent.changeText(expiry, '01');
    expect(screen.getByLabelText('Expiry').props.value).toBe('01/');
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '01/30');
    expect(screen.getByText('Jan 2030')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Expiry'), '0120');
    expect(screen.getByLabelText('Expiry').props.value).toBe('01/20');
    const past = screen.getByText('Jan 2020 · Already expired');
    expect(past.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: tokens.color.expired })]),
    );
  });

  it('Save & next saves one row and clears only name, batch, expiry and quantity', async () => {
    const s = await seed();
    const spy = jest.spyOn(s.repos.inventory, 'saveIntake');
    await renderRouter(routes(s.repos), { initialUrl: '/intake/manual' });
    const next = () => screen.getByRole('button', { name: 'Save & next' });
    await fireEvent.changeText(await screen.findByLabelText('Medicine name'), 'Zincovit');
    expect(next()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Company'), 'Apex');
    await pick('Category', 'Vitamins');
    await pick('Unit', 'Strip');
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
    expect(select('Category')).toBe('Category, Vitamins');
    expect(select('Unit')).toBe('Unit, Strip');
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

describe('typeExpiry', () => {
  it.each([
    ['1', '', '1'],
    ['11', '1', '11/'],
    ['11', '11/', '11'], // backspacing over the slash doesn't put it back
    ['112', '11/', '11/2'],
    ['11/2026', '11/202', '11/2026'],
    ['Nov 2026', 'Nov 202', 'Nov 2026'],
  ])('%s after %s → %s', (next, prev, out) => expect(typeExpiry(next, prev)).toBe(out));
});
