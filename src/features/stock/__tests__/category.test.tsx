import { router } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Repos } from '@/data/repositories';
import { emptyDraft } from '@/domain/draft';
import type { Category, Unit } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import TabsLayout from '../../../../app/(tabs)/_layout';
import StockTab from '../../../../app/(tabs)/stock';
import CategoryRoute from '../../../../app/category/[id]';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const DAY = 86_400_000;
const TODAY = new Date(2026, 10, 6);

const routes = (repos: Repos) => ({
  _layout: () => (
    <ToastProvider>
      <AppShell repos={repos} />
    </ToastProvider>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': () => null,
  '(tabs)/stock': StockTab,
  '(tabs)/check': () => null,
  '(tabs)/settings': () => null,
  'category/[id]': CategoryRoute,
});

type Row = [
  cat: string,
  med: string,
  company: string,
  batch: string,
  y: number,
  m: number,
  qty: number,
  unit: Unit,
];
const ROWS: Row[] = [
  ['Antibiotics', 'Amoxil', 'Cipla', 'A1', 2026, 10, 4, 'carton'],
  ['Antibiotics', 'Azithral', 'Alembic', 'A2', 2026, 9, 2, 'carton'],
  ['Antibiotics', 'Zox', 'Cipla', 'A3', 2026, 11, 3, 'carton'],
  ['Antibiotics', 'Althrocin', 'Alembic', 'A4', 2028, 12, 3, 'carton'],
  ['Antibiotics', 'Althrocin', 'Alembic', 'A5', 2028, 11, 2, 'carton'],
  ['Balms', 'Volini', 'Sun', 'B1', 2028, 1, 2, 'tube'],
];

async function seed(checked: number | null = 18) {
  let t = 1;
  const repos = createMemoryRepos(() => t++);
  const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
  let cats: Category[] = [];
  repos.inventory.watchCategories(shopId, (c) => (cats = c))();
  const id = (name: string) => cats.find((c) => c.name === name)!.id;
  for (const [cat, med, company, batchNo, year, month, qty, unit] of ROWS) {
    await repos.inventory.saveIntake(
      shopId,
      [
        {
          ...emptyDraft('manual'),
          medicineName: med,
          companyName: company,
          categoryId: id(cat),
          unit,
          batchNo,
          expiry: { year, month },
          qty,
        },
      ],
      null,
      deviceId,
    );
  }
  const anti = cats.find((c) => c.name === 'Antibiotics')!;
  await repos.inventory.upsertCategory(shopId, {
    ...anti,
    lastCheckedAt: checked === null ? null : TODAY.getTime() - checked * DAY,
  });
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
  return { repos, shopId, anti, id };
}

const cats = (repos: Repos, shopId: string) => {
  let out: Category[] = [];
  repos.inventory.watchCategories(
    shopId,
    (c) => (out = [...c].sort((a, b) => a.order - b.order)),
  )();
  return Promise.resolve(out);
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

describe('category screen', () => {
  const open = async (checked: number | null = 18) => {
    const s = await seed(checked);
    await renderRouter(routes(s.repos), { initialUrl: `/category/${s.anti.id}` });
    await screen.findByRole('header', { name: 'Antibiotics' });
    return s;
  };

  it('shows computed meta', async () => {
    await open();
    expect(
      await screen.findByText('4 medicines · 14 units · checked 18 days ago'),
    ).toBeOnTheScreen();
  });

  it('says never checked / checked today', async () => {
    await open(null);
    expect(await screen.findByText('4 medicines · 14 units · never checked')).toBeOnTheScreen();
  });

  it('checked today when 0 days', async () => {
    await open(0);
    expect(await screen.findByText('4 medicines · 14 units · checked today')).toBeOnTheScreen();
  });

  it('offers All companies plus this category companies only', async () => {
    await open();
    await screen.findByRole('button', { name: 'All companies' });
    expect(screen.getByRole('button', { name: 'Alembic' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cipla' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sun' })).toBeNull();
  });

  it('splits needs action (by expiry) from all good, with subtitles and pills', async () => {
    await open();
    await screen.findByRole('header', { name: 'NEEDS ACTION' });
    expect(screen.getByRole('header', { name: 'ALL GOOD' })).toBeOnTheScreen();
    const names = screen
      .getAllByRole('button', { name: /^(Amoxil|Azithral|Zox|Althrocin),/ })
      .map((n) => n.props.accessibilityLabel);
    expect(names).toEqual([
      'Azithral, Alembic · 2 cartons',
      'Amoxil, Cipla · 4 cartons',
      'Zox, Cipla · 3 cartons',
      'Althrocin, Alembic · 5 cartons · 2 batches',
    ]);
    const az = within(screen.getByRole('button', { name: /^Azithral,/ }));
    expect(az.getByText('Expired 30 Sep')).toBeOnTheScreen();
    expect(
      within(screen.getByRole('button', { name: /^Zox,/ })).getByText('Nov 2026'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByRole('button', { name: /^Althrocin,/ })).getByText('Nov 2028'),
    ).toBeOnTheScreen();
  });

  it('filters by company and opens the medicine', async () => {
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Cipla' }));
    expect(screen.queryByRole('button', { name: /^Azithral,/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Amoxil,/ })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'ALL GOOD' })).toBeNull();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: /^Amoxil,/ }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/medicine\/.+/));
    await fireEvent.press(screen.getByRole('button', { name: 'All companies' }));
    expect(screen.getByRole('button', { name: /^Azithral,/ })).toBeOnTheScreen();
  });
});

describe('stock tab', () => {
  it('lists categories and adds one', async () => {
    const { repos, shopId } = await seed();
    await renderRouter(routes(repos), { initialUrl: '/stock' });
    expect(await screen.findByRole('header', { name: 'Stock' })).toBeOnTheScreen();
    const before = await cats(repos, shopId);
    await fireEvent.press(await screen.findByRole('button', { name: '+ Add category' }));
    await fireEvent.changeText(screen.getByLabelText('Category name'), 'Eye drops');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /^Eye drops,/ })).toBeOnTheScreen();
    const after = await cats(repos, shopId);
    expect(after.at(-1)).toMatchObject({
      name: 'Eye drops',
      order: Math.max(...before.map((c) => c.order)) + 1,
    });
  });

  it('reorders and persists order', async () => {
    const { repos, shopId } = await seed();
    await renderRouter(routes(repos), { initialUrl: '/stock' });
    const [a, b] = await cats(repos, shopId);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit order' }));
    await fireEvent.press(screen.getByRole('button', { name: `Move ${b.name} up` }));
    const [x, y] = await cats(repos, shopId);
    expect([x.id, y.id]).toEqual([b.id, a.id]);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('button', { name: `Move ${b.name} up` })).toBeNull();
  });
});
