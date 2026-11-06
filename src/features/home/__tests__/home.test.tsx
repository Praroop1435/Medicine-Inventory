import { router } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Repos } from '@/data/repositories';
import { emptyDraft } from '@/domain/draft';
import type { Batch, Category, Medicine, Unit } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import { tokens } from '@/ui';
import { CategoryList } from '../components/CategoryList';
import { dueFolder } from '../components/CheckReminder';
import { daysSince } from '@/lib/format';
import TabsLayout from '../../../../app/(tabs)/_layout';
import Home from '../../../../app/(tabs)/index';
import Alerts from '../../../../app/alerts/[status]';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const DAY = 86_400_000;
const TODAY = new Date(2026, 10, 6); // Fri 6 Nov 2026

const routes = (repos: Repos) => ({
  _layout: () => (
    <ToastProvider>
      <AppShell repos={repos} />
    </ToastProvider>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Home,
  '(tabs)/stock': () => <CategoryList />,
  '(tabs)/check': () => null,
  '(tabs)/settings': () => null,
  'alerts/[status]': Alerts,
});

type Row = [
  cat: string,
  med: string,
  company: string,
  batch: string,
  y: number,
  m: number,
  qty: number,
  unit?: Unit,
];
// Today is 6 Nov 2026: Sep/Oct 2026 expired, Nov 2026 within 30 days, Dec 2026 / Jan 2027 within 90.
const ROWS: Row[] = [
  ['Antibiotics', 'Amoxil', 'Cipla', 'A1', 2026, 10, 4],
  ['Antibiotics', 'Azithral', 'Alembic', 'A2', 2026, 9, 2],
  ['Pain relief', 'Crocin', 'GSK', 'P1', 2026, 10, 3],
  ['Cough syrups', 'Benadryl', 'J&J', 'C1', 2026, 11, 6, 'bottle'],
  ['Cough syrups', 'Corex', 'Pfizer', 'C2', 2026, 11, 1, 'bottle'],
  ['Balms', 'Volini', 'Sun', 'B1', 2026, 11, 2, 'tube'],
  ['Balms', 'Moov', 'Reckitt', 'B2', 2026, 11, 3, 'tube'],
  ['Pain relief', 'Dolo', 'Micro Labs', 'D1', 2026, 11, 10],
  ['Lotions', 'Candid', 'Glenmark', 'L1', 2026, 12, 1, 'bottle'],
  ['Lotions', 'Cetaphil', 'Galderma', 'L2', 2026, 12, 2, 'bottle'],
  ['Lotions', 'Nivea', 'Beiersdorf', 'L3', 2026, 12, 3, 'bottle'],
  ...Array.from({ length: 11 }, (_, i): Row => [
    'Vitamins',
    `Zincovit ${i}`,
    'Apex',
    `V${i}`,
    2027,
    1,
    1,
  ]),
  ['Others', 'Eno', 'Haleon', 'E1', 2028, 12, 5],
];

async function seed(opts: { checked?: Record<string, number | null> } = {}) {
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
          unit: unit ?? 'strip',
          batchNo,
          expiry: { year, month },
          qty,
        },
      ],
      null,
      deviceId,
    );
  }
  // Every category checked recently unless overridden; null = never.
  for (const c of cats) {
    const days = opts.checked?.[c.name];
    const lastCheckedAt =
      days === undefined
        ? TODAY.getTime() - DAY
        : days === null
          ? null
          : TODAY.getTime() - days * DAY;
    await repos.inventory.upsertCategory(shopId, { ...c, lastCheckedAt });
  }
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
  return { repos, shopId, deviceId };
}

const open = async (repos: Repos, url = '/') => {
  const r = await renderRouter(routes(repos), { initialUrl: url });
  await screen.findByRole('header', { name: 'Anand Medicals' }).catch(() => undefined);
  return r;
};

beforeEach(() => {
  mockStore.clear();
  // Fake only Date so timers and promises keep running.
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

describe('home', () => {
  it('shows the shop name, date, sync text and the three counts', async () => {
    const { repos } = await seed();
    await open(repos);
    expect(await screen.findByText('Fri 6 Nov · synced')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Expired 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'In 30 days 5' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'In 90 days 14' })).toBeOnTheScreen();
  });

  it('derives the strip labels from alertDays', async () => {
    const { repos, shopId, deviceId } = await seed();
    await repos.shop.updateShop(shopId, { alertDays: { first: 90, second: 60 } }, deviceId);
    await open(repos);
    expect(await screen.findByRole('button', { name: 'In 60 days 8' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'In 90 days 11' })).toBeOnTheScreen();
  });

  it('shows one worst-status pill per category and none for all-ok ones', async () => {
    const { repos } = await seed();
    await open(repos, '/stock'); // the Stock tab shows the full list
    const row = async (name: string) =>
      within(await screen.findByRole('button', { name: new RegExp(`^${name},`) }));
    expect((await row('Antibiotics')).getByText('2 expired')).toBeOnTheScreen();
    expect((await row('Antibiotics')).getByText('2 medicines · 6 units')).toBeOnTheScreen();
    expect((await row('Cough syrups')).getByText('2 soon')).toBeOnTheScreen();
    expect((await row('Lotions')).getByText('3 in 90 days')).toBeOnTheScreen();
    expect((await row('Others')).queryByTestId('status-pill')).toBeNull();
  });

  it('opens the soon list, soonest first, with date pill and qty line', async () => {
    const { repos } = await seed();
    const r = await open(repos);
    await fireEvent.press(await screen.findByRole('button', { name: 'In 30 days 5' }));
    expect(await screen.findByRole('header', { name: 'Expiring in 30 days' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/alerts/soon');
    expect(screen.getAllByTestId('status-pill')).toHaveLength(5);
    expect(screen.getAllByText(/ · Batch /).map((n) => n.props.children)).toEqual([
      'J&J · Batch C1 · Nov 2026',
      'Pfizer · Batch C2 · Nov 2026',
      'Sun · Batch B1 · Nov 2026',
      'Reckitt · Batch B2 · Nov 2026',
      'Micro Labs · Batch D1 · Nov 2026',
    ]);
    // The pill reads relative time; the month is in the subtitle.
    const first = within(
      screen.getByRole('button', { name: 'Benadryl, J&J · Batch C1 · Nov 2026' }),
    );
    expect(first.getByText('in 24 days')).toBeOnTheScreen();
    expect(first.getByText('6 bottles')).toBeOnTheScreen();
  });

  it('the expired list is soonest first and rows open the medicine', async () => {
    const { repos } = await seed();
    await open(repos, '/alerts/expired');
    expect(await screen.findByRole('header', { name: 'Expired' })).toBeOnTheScreen();
    expect(screen.getAllByText(/ · Batch /).map((n) => n.props.children)).toEqual([
      'Alembic · Batch A2 · Sep 2026',
      'Cipla · Batch A1 · Oct 2026',
      'GSK · Batch P1 · Oct 2026',
    ]);
    const a2 = within(screen.getByRole('button', { name: /^Azithral,/ }));
    expect(a2.getByText('37 days ago')).toBeOnTheScreen();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: /^Azithral,/ }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/medicine\/.+/));
  });

  it('strip counts and category rows navigate', async () => {
    const { repos } = await seed();
    await open(repos);
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(await screen.findByRole('button', { name: 'Expired 3' }));
    expect(push).toHaveBeenLastCalledWith('/alerts/expired');
    await fireEvent.press(screen.getByRole('button', { name: 'In 90 days 14' }));
    expect(push).toHaveBeenLastCalledWith('/alerts/watch');
    await fireEvent.press(screen.getByRole('button', { name: /^Antibiotics,/ }));
    expect(push).toHaveBeenLastCalledWith(expect.stringMatching(/^\/category\/.+/));
  });

  it('reminds about the category checked longest ago', async () => {
    const { repos } = await seed({ checked: { Balms: 18 } });
    await open(repos);
    expect(await screen.findByText('Balms not checked')).toBeOnTheScreen();
    expect(screen.getByText('Last stock check 18 days ago')).toBeOnTheScreen();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Start check' }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/check\/.+/));
  });

  it('a never-checked category wins the reminder', async () => {
    const { repos } = await seed({ checked: { Balms: 18, Lotions: null } });
    await open(repos);
    expect(await screen.findByText('Lotions not checked')).toBeOnTheScreen();
    expect(screen.getByText('Never checked')).toBeOnTheScreen();
  });

  it('skips folders with nothing on the shelf, even never-checked ones', async () => {
    const { repos } = await seed({ checked: { Balms: 18, 'Eye/ear drops': null } });
    await open(repos);
    expect(await screen.findByText('Balms not checked')).toBeOnTheScreen();
    expect(screen.queryByText('Eye/ear drops not checked')).toBeNull();
  });

  it('when every stocked folder was checked today, says so instead of nudging', async () => {
    const checked = Object.fromEntries(
      ['Antibiotics', 'Pain relief', 'Cough syrups', 'Balms', 'Lotions', 'Vitamins', 'Others'].map(
        (n) => [n, 0],
      ),
    );
    // Never checked but empty: not due.
    const { repos } = await seed({ checked: { ...checked, 'Eye/ear drops': null } });
    await open(repos);
    expect(await screen.findByText('All stock checked today ✓')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start check' })).toBeNull();
  });

  it('first run: 0 / 0 / 0 in muted grey and an Add your first stock card instead of categories', async () => {
    const repos = createMemoryRepos();
    const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
    mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
    await open(repos);
    const zero = await screen.findByRole('button', { name: 'Expired 0' });
    expect(screen.getByRole('button', { name: 'In 30 days 0' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'In 90 days 0' })).toBeOnTheScreen();
    // Zero is never a warning: muted, not the expired red.
    expect(StyleSheet.flatten(within(zero).getByText('0').props.style).color).toBe(
      tokens.color.muted,
    );
    expect(screen.getByRole('header', { name: 'Add your first stock' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Antibiotics,/ })).toBeNull();
    expect(screen.queryByText('Stock check')).toBeNull();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    for (const [label, href] of [
      ['Scan bill', '/intake/scan'],
      ['Speak', '/intake/voice'],
      ['Type', '/intake/manual'],
      ['Bulk import from a spreadsheet', '/intake/bulk'],
    ]) {
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(push).toHaveBeenLastCalledWith(href);
    }
  });

  it('with stock, a count above zero takes its status colour', async () => {
    const { repos } = await seed();
    await open(repos);
    const expired = await screen.findByRole('button', { name: 'Expired 3' });
    expect(StyleSheet.flatten(within(expired).getByText('3').props.style).color).toBe(
      tokens.color.expired,
    );
    expect(screen.queryByText('Add your first stock')).toBeNull();
  });

  it('shows skeletons while the inventory is loading', async () => {
    const repos = createMemoryRepos();
    const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
    mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
    jest.spyOn(repos.inventory, 'watchLiveBatches').mockReturnValue(() => {});
    await open(repos);
    expect((await screen.findAllByLabelText('Loading')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Expired/ })).toBeNull();
  });

  it('searches by name and batch number, taps through, and clears', async () => {
    const { repos } = await seed();
    await open(repos);
    await fireEvent.changeText(await screen.findByLabelText('Search medicines'), 'azi');
    expect(await screen.findByRole('button', { name: /^Azithral,/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Expired/ })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search medicines'), 'p1');
    expect(
      await screen.findByRole('button', { name: /^Crocin, GSK · 3 strips · Batch P1/ }),
    ).toBeOnTheScreen();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: /^Crocin,/ }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/medicine\/.+/));
    await fireEvent.changeText(screen.getByLabelText('Search medicines'), 'zzzz');
    expect(await screen.findByText('No medicine matches “zzzz”')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByRole('button', { name: 'Expired 3' })).toBeOnTheScreen();
  });

  it('See all opens the Stock tab', async () => {
    const { repos } = await seed();
    await open(repos);
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(await screen.findByRole('button', { name: 'See all' }));
    expect(push).toHaveBeenCalledWith('/stock');
  });
});

describe('dueFolder', () => {
  const cat = (id: string, order: number, lastCheckedAt: number | null): Category => ({
    id,
    name: id,
    order,
    lastCheckedAt,
    parentId: null,
  });
  const med = (id: string, categoryId: string) => ({ id, categoryId }) as Medicine;
  const batch = (medicineId: string) => ({ id: medicineId + 'b', medicineId }) as Batch;
  it('never-checked first, then the oldest check, only folders with live stock', () => {
    const cats = [cat('anti', 0, TODAY.getTime()), cat('cough', 1, null), cat('empty', 2, null)];
    const meds = [med('a', 'anti'), med('c', 'cough')];
    expect(dueFolder(cats, meds, [batch('a'), batch('c')])?.id).toBe('cough');
    expect(dueFolder(cats, meds, [batch('a')])?.id).toBe('anti');
    // A folder whose doc lacks the field counts as never checked.
    const loose = { ...cat('loose', 3, null), lastCheckedAt: undefined } as unknown as Category;
    expect(
      dueFolder([cats[0], loose], [...meds, med('l', 'loose')], [batch('a'), batch('l')])?.id,
    ).toBe('loose');
  });
  it('counts calendar days: yesterday afternoon is 1 day ago, not 0', () => {
    expect(daysSince(new Date(2026, 10, 5, 15).getTime(), TODAY)).toBe(1);
    expect(daysSince(new Date(2026, 10, 6, 9).getTime(), TODAY)).toBe(0);
  });
});
