import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Repos } from '@/data/repositories';
import { emptyDraft } from '@/domain/draft';
import type { Category } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import TabsLayout from '../../../../app/(tabs)/_layout';
import HomeTab from '../../../../app/(tabs)/index';
import StockTab from '../../../../app/(tabs)/stock';
import CategoryRoute from '../../../../app/category/[id]';

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
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeTab,
  '(tabs)/stock': StockTab,
  '(tabs)/check': () => null,
  '(tabs)/settings': () => null,
  'category/[id]': CategoryRoute,
});

// Today is 6 Nov 2026. Cough syrups › Dry › Kids, Cough syrups › Wet, Cough syrups › Empty.
async function seed() {
  let t = 1;
  const repos = createMemoryRepos(() => t++);
  const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
  const all = () => {
    let cs: Category[] = [];
    repos.inventory.watchCategories(shopId, (c) => (cs = c))();
    return cs;
  };
  const id = (name: string) => all().find((c) => c.name === name)!.id;
  const folder = (name: string, parentId: string, order: number) =>
    repos.inventory.upsertCategory(shopId, { name, order, lastCheckedAt: null, parentId });
  await folder('Dry', id('Cough syrups'), 0);
  await folder('Wet', id('Cough syrups'), 1);
  await folder('Empty', id('Cough syrups'), 2);
  await folder('Kids', id('Dry'), 0);
  const rows = [
    ['Cough syrups', 'Benadryl', 'J&J', 2028, 1, 2],
    ['Dry', 'Ascoril', 'Glenmark', 2026, 9, 3],
    ['Kids', 'Tixy', 'Cipla', 2026, 11, 2],
    ['Wet', 'Grilinctus', 'Franco', 2028, 3, 1],
  ] as const;
  for (const [cat, medicineName, companyName, year, month, qty] of rows)
    await repos.inventory.saveIntake(
      shopId,
      [
        {
          ...emptyDraft('manual'),
          medicineName,
          companyName,
          categoryId: id(cat),
          unit: 'bottle',
          batchNo: medicineName.slice(0, 2).toUpperCase(),
          expiry: { year, month },
          qty,
        },
      ],
      null,
      deviceId,
    );
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
  return { repos, shopId, deviceId, all, id };
}
type Seed = Awaited<ReturnType<typeof seed>>;

const open = async (s: Seed, name: string, header: string) => {
  await renderRouter(routes(s.repos), { initialUrl: `/category/${s.id(name)}` });
  await screen.findByRole('header', { name: header });
};
const menu = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name: `More, ${name}` }));

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

describe('folders', () => {
  it('Stock tab shows only top-level folders with rolled-up counts and pill', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/stock' });
    const row = await screen.findByRole('button', { name: 'Cough syrups, 4 medicines · 8 units' });
    expect(within(row).getByText('1 expired')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Dry,/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Kids,/ })).toBeNull();
  });

  it('Home shows only top-level folders with rolled-up pills', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/' });
    const row = await screen.findByRole('button', { name: 'Cough syrups, 4 medicines · 8 units' });
    expect(within(row).getByText('1 expired')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Dry,/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'All 9' })).toBeOnTheScreen();
  });

  it('a folder shows its path, rolled-up meta, sub-folders first, then its own medicines', async () => {
    const s = await seed();
    await open(s, 'Dry', 'Cough syrups › Dry');
    expect(screen.getByRole('button', { name: 'Back, Cough syrups' })).toBeOnTheScreen();
    expect(screen.getByText('2 medicines · 5 units · never checked')).toBeOnTheScreen();
    const labels = screen
      .getAllByRole('button', { name: /^(Kids|Ascoril|Tixy),/ })
      .map((n) => n.props.accessibilityLabel as string);
    expect(labels).toEqual(['Kids, 1 medicine · 2 units', 'Ascoril, Glenmark · 3 bottles']);
    const kids = screen.getByRole('button', { name: /^Kids,/ });
    expect(within(kids).getByText('1 soon')).toBeOnTheScreen();
  });

  it('company chips cover only medicines directly in the folder', async () => {
    const s = await seed();
    await open(s, 'Cough syrups', 'Cough syrups');
    await screen.findByRole('button', { name: 'All companies' });
    expect(screen.getByRole('button', { name: 'J&J' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Glenmark' })).toBeNull();
    expect(screen.getByText('4 medicines · 8 units · never checked')).toBeOnTheScreen();
  });

  it('+ New folder creates a child here, last among its siblings', async () => {
    const s = await seed();
    await open(s, 'Cough syrups', 'Cough syrups');
    await fireEvent.press(screen.getByRole('button', { name: '+ New folder' }));
    await fireEvent.changeText(screen.getByLabelText('Folder name'), 'Herbal');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /^Herbal,/ })).toBeOnTheScreen();
    expect(s.all().find((c) => c.name === 'Herbal')).toMatchObject({
      parentId: s.id('Cough syrups'),
      order: 3,
    });
  });

  it('+ New folder on the Stock tab creates a top-level folder', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/stock' });
    await fireEvent.press(await screen.findByRole('button', { name: '+ New folder' }));
    await fireEvent.changeText(screen.getByLabelText('Folder name'), 'Eye drops');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /^Eye drops,/ })).toBeOnTheScreen();
    expect(s.all().find((c) => c.name === 'Eye drops')).toMatchObject({ parentId: null, order: 9 });
  });

  it('⋯ Rename renames the folder', async () => {
    const s = await seed();
    await open(s, 'Dry', 'Cough syrups › Dry');
    await menu('Kids');
    await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByLabelText('Folder name').props.value).toBe('Kids');
    await fireEvent.changeText(screen.getByLabelText('Folder name'), 'Children');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /^Children,/ })).toBeOnTheScreen();
    expect(s.all().find((c) => c.name === 'Children')?.parentId).toBe(s.id('Dry'));
  });

  it('⋯ Move to… lists folders as paths without itself, its descendants or its parent', async () => {
    const s = await seed();
    await open(s, 'Cough syrups', 'Cough syrups');
    await menu('Dry');
    await fireEvent.press(screen.getByRole('button', { name: 'Move to…' }));
    expect(screen.getByRole('button', { name: 'Top level' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cough syrups › Wet' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cough syrups › Dry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cough syrups › Dry › Kids' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cough syrups' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Antibiotics' }));
    expect(s.all().find((c) => c.name === 'Dry')?.parentId).toBe(s.id('Antibiotics'));
    expect(screen.queryByRole('button', { name: /^Dry,/ })).toBeNull();
  });

  it('⋯ Delete is disabled with a reason when the folder is not empty', async () => {
    const s = await seed();
    await open(s, 'Cough syrups', 'Cough syrups');
    await menu('Wet');
    const del = screen.getByRole('button', { name: "Delete, Move or remove what's inside first" });
    expect(del).toBeDisabled();
    await fireEvent.press(del);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(s.all().some((c) => c.name === 'Wet')).toBe(true);
  });

  it('⋯ Delete of an empty folder asks first: Cancel keeps it, Delete removes it', async () => {
    const s = await seed();
    await open(s, 'Cough syrups', 'Cough syrups');
    await menu('Empty');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('header', { name: 'Delete folder “Empty”?' })).toBeOnTheScreen();
    expect(screen.getByText("This can't be undone.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(s.all().some((c) => c.name === 'Empty')).toBe(true);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();

    await menu('Empty');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.press(
      within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(s.all().some((c) => c.name === 'Empty')).toBe(false);
    expect(screen.queryByRole('button', { name: /^Empty,/ })).toBeNull();
  });

  it('Edit order moves folders within their sibling group', async () => {
    const s = await seed();
    await open(s, 'Cough syrups', 'Cough syrups');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit order' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Move Wet up' }));
    const kids = s.all().filter((c) => c.parentId === s.id('Cough syrups'));
    expect([...kids].sort((a, b) => a.order - b.order).map((c) => c.name)).toEqual([
      'Wet',
      'Dry',
      'Empty',
    ]);
    expect(s.all().find((c) => c.name === 'Antibiotics')?.order).toBe(0);
  });
});
