import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { CheckSession, Repos } from '@/data/repositories';
import { emptyDraft } from '@/domain/draft';
import type { Batch, Category, StockEvent } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import CheckTab from '../../../../app/(tabs)/check';
import CheckRoute from '../../../../app/check/[categoryId]';

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
  '(tabs)/check': CheckTab,
  'check/[categoryId]': CheckRoute,
});

// Today is 6 Nov 2026, so AMX31 (Oct 2026) is expired.
const ROWS = [
  ['Antibiotics', 'Ciplox 500', 'Cipla', 'CX210', 2027, 9, 3],
  ['Antibiotics', 'Azithral 500', 'Alembic', 'AZ94', 2027, 8, 3],
  ['Antibiotics', 'Amoxyclav 625', 'Cipla', 'AMX31', 2026, 10, 1],
  ['Antibiotics', 'Azithral 500', 'Alembic', 'AZ88', 2026, 11, 2],
  ['Pain relief', 'Dolo', 'Micro Labs', 'D1', 2027, 1, 4],
] as const;

async function seed() {
  let t = TODAY.getTime();
  const repos = createMemoryRepos(() => t++);
  const { shopId, deviceId, joinSecret } = await repos.shop.createShop('Anand Medicals', 'Ravi');
  const { deviceId: priya } = await repos.shop.joinShop(shopId, joinSecret, 'Priya');
  const cat = (name: string) => {
    let cats: Category[] = [];
    repos.inventory.watchCategories(shopId, (c) => (cats = c))();
    return cats.find((c) => c.name === name)!;
  };
  for (const [c, medicineName, companyName, batchNo, year, month, qty] of ROWS)
    await repos.inventory.saveIntake(
      shopId,
      [
        {
          ...emptyDraft('manual'),
          medicineName,
          companyName,
          categoryId: cat(c).id,
          unit: 'strip',
          batchNo,
          expiry: { year, month },
          qty,
        },
      ],
      null,
      deviceId,
    );
  const ids = () => {
    let b: Batch[] = [];
    repos.inventory.watchLiveBatches(shopId, (x) => (b = x))();
    return Object.fromEntries(b.map((x) => [x.batchNo, x]));
  };
  // Priya has already ticked one row on her phone.
  await repos.check.markChecked(shopId, cat('Antibiotics').id, ids().AZ88.id, 2, priya);
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Ravi' }));
  return { repos, shopId, deviceId, priya, cat, batch: (no: string) => ids()[no] };
}
type Seed = Awaited<ReturnType<typeof seed>>;

const session = (s: Seed) => {
  let v: CheckSession | null = null;
  s.repos.check.watchCheck(s.shopId, s.cat('Antibiotics').id, (x) => (v = x))();
  return v as CheckSession | null;
};
const lastEvent = (s: Seed, batchNo: string) => {
  let e: StockEvent[] = [];
  s.repos.inventory.watchMedicineEvents(
    s.shopId,
    s.batch(batchNo).medicineId,
    50,
    (x) => (e = x),
  )();
  return e.find((x) => x.batchId === s.batch(batchNo).id);
};
const tick = (batchNo: string) => screen.getByRole('button', { name: `Count matches, ${batchNo}` });
const row = (batchNo: string) => screen.getByTestId(`check-row-${batchNo}`);

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
  await renderRouter(routes(s.repos), { initialUrl: `/check/${s.cat('Antibiotics').id}` });
  await screen.findByRole('header', { name: 'Antibiotics' });
  return s;
};

describe('check screen', () => {
  it('shows progress with the last checker and a progress bar', async () => {
    await open();
    expect(await screen.findByText('1 of 4 batches checked · Priya')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
      min: 0,
      max: 100,
      now: 25,
    });
  });

  it('groups rows by company, alphabetically, and leaves other categories out', async () => {
    await open();
    const text = screen
      .getAllByText(/^(ALEMBIC|CIPLA|MICRO LABS|Azithral 500|Amoxyclav 625|Ciplox 500|Dolo)$/)
      .map((n) => n.props.children)
      .join('|');
    expect(text).toBe('ALEMBIC|Azithral 500|Azithral 500|CIPLA|Amoxyclav 625|Ciplox 500');
    expect(within(row('AZ88')).getByText('AZ88 · exp Nov 2026')).toBeOnTheScreen();
    expect(within(row('AMX31')).getByText('expired Oct 2026')).toBeOnTheScreen();
  });

  it('the tick fills once checked and records the shelf count', async () => {
    const s = await open();
    expect(tick('AZ88')).toBeSelected();
    expect(tick('CX210')).not.toBeSelected();
    await fireEvent.press(tick('CX210'));
    expect(await screen.findByText('2 of 4 batches checked · Ravi')).toBeOnTheScreen();
    expect(tick('CX210')).toBeSelected();
    expect(lastEvent(s, 'CX210')).toMatchObject({ type: 'checked', delta: 0 });
    expect(Object.keys(session(s)!.checked)).toContain(s.batch('CX210').id);
  });

  it('the stepper fixes the count; changing a checked row re-enables its tick', async () => {
    const s = await open();
    await fireEvent.press(within(row('AZ88')).getByRole('button', { name: 'Increase' }));
    expect(tick('AZ88')).not.toBeSelected();
    await fireEvent.press(tick('AZ88'));
    await act(async () => {});
    expect(tick('AZ88')).toBeSelected();
    expect(s.batch('AZ88').qty).toBe(3);
    expect(lastEvent(s, 'AZ88')).toMatchObject({ type: 'checked', delta: 1 });
  });

  it('counting 0 asks first: Cancel keeps the batch, Close batch closes it', async () => {
    const s = await open();
    await fireEvent.press(within(row('AMX31')).getByRole('button', { name: 'Decrease' }));
    await fireEvent.press(tick('AMX31'));
    expect(screen.getByText('This closes batch AMX31.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(s.batch('AMX31').qty).toBe(1);
    expect(tick('AMX31')).not.toBeSelected();
    await fireEvent.press(tick('AMX31'));
    await fireEvent.press(screen.getByRole('button', { name: 'Close batch' }));
    await act(async () => {});
    expect(screen.queryByTestId('check-row-AMX31')).toBeNull();
    expect(s.batch('AMX31')).toBeUndefined();
  });

  it("shows another phone's progress live", async () => {
    const s = await open();
    expect(tick('AZ94')).not.toBeSelected();
    await act(() =>
      s.repos.check.markChecked(s.shopId, s.cat('Antibiotics').id, s.batch('AZ94').id, 3, s.priya),
    );
    expect(tick('AZ94')).toBeSelected();
    expect(screen.getByText('2 of 4 batches checked · Priya')).toBeOnTheScreen();
  });

  it('+ Add batch opens manual entry with the category preset', async () => {
    const s = await open();
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: '+ Add batch' }));
    expect(push).toHaveBeenCalledWith(`/intake/manual?categoryId=${s.cat('Antibiotics').id}`);
  });

  it('finishing with every row checked sets lastCheckedAt and goes back', async () => {
    const s = await open();
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    for (const no of ['AZ94', 'AMX31', 'CX210']) {
      await fireEvent.press(tick(no));
      await act(async () => {});
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Finish check' }));
    expect(await screen.findByText('Antibiotics checked')).toBeOnTheScreen();
    expect(back).toHaveBeenCalled();
    expect(s.cat('Antibiotics').lastCheckedAt).toEqual(expect.any(Number));
    expect(session(s)).toBeNull();
  });

  it('finishing early asks, keeps progress and leaves lastCheckedAt alone', async () => {
    const s = await open();
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Finish check' }));
    expect(screen.getByText('Finish with 3 unchecked? They stay as they are.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(back).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Finish check' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Saved progress · 1 of 4 checked')).toBeOnTheScreen();
    expect(back).toHaveBeenCalled();
    expect(s.cat('Antibiotics').lastCheckedAt).toBeNull();
    expect(session(s)).not.toBeNull();
  });
});

describe('nested folders', () => {
  const withSubFolder = async () => {
    const s = await seed();
    const kids = await s.repos.inventory.upsertCategory(s.shopId, {
      name: 'Kids',
      order: 0,
      lastCheckedAt: null,
      parentId: s.cat('Antibiotics').id,
    });
    await s.repos.inventory.saveIntake(
      s.shopId,
      [
        {
          ...emptyDraft('manual'),
          medicineName: 'Moxikind',
          companyName: 'Mankind',
          categoryId: kids,
          unit: 'strip',
          batchNo: 'MK1',
          expiry: { year: 2027, month: 2 },
          qty: 2,
        },
      ],
      null,
      s.deviceId,
    );
    return { ...s, kids };
  };

  it('checking a parent covers sub-folder batches, grouped by sub-folder then company', async () => {
    const s = await withSubFolder();
    await renderRouter(routes(s.repos), { initialUrl: `/check/${s.cat('Antibiotics').id}` });
    expect(await screen.findByText('1 of 5 batches checked · Priya')).toBeOnTheScreen();
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    const heads = screen
      .getAllByRole('header')
      .map((n) => n.props.children as string)
      .filter((t) => t !== 'Antibiotics');
    expect(heads).toEqual(['ALEMBIC', 'CIPLA', 'KIDS · MANKIND']);
    for (const no of ['AZ94', 'AMX31', 'CX210', 'MK1']) {
      await fireEvent.press(tick(no));
      await act(async () => {});
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Finish check' }));
    expect(await screen.findByText('Antibiotics checked')).toBeOnTheScreen();
    expect(back).toHaveBeenCalled();
    let cats: Category[] = [];
    s.repos.inventory.watchCategories(s.shopId, (c) => (cats = c))();
    expect(cats.find((c) => c.id === s.kids)?.lastCheckedAt).toEqual(expect.any(Number));
  });

  it('the check tab lists top-level folders only, counting sub-folder batches', async () => {
    const s = await withSubFolder();
    await renderRouter(routes(s.repos), { initialUrl: '/check' });
    expect(
      await screen.findByRole('button', { name: 'Antibiotics, partly checked · 1 of 5' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Kids,/ })).toBeNull();
  });
});

describe('check tab', () => {
  it('lists categories least recently checked first with their state', async () => {
    const s = await seed();
    for (const [name, days] of [
      ['Antibiotics', null],
      ['Pain relief', 3],
      ['Cough syrups', 1],
    ] as const)
      await s.repos.inventory.upsertCategory(s.shopId, {
        ...s.cat(name),
        lastCheckedAt: days === null ? null : TODAY.getTime() - days * DAY,
      });
    for (const c of [
      'Balms',
      'Lotions',
      'Eye/ear drops',
      'Tablets (general)',
      'Vitamins',
      'Others',
    ])
      await s.repos.inventory.upsertCategory(s.shopId, {
        ...s.cat(c),
        lastCheckedAt: TODAY.getTime(),
      });
    await renderRouter(routes(s.repos), { initialUrl: '/check' });
    await screen.findByRole('header', { name: 'Check' });
    const names = (await screen.findAllByRole('button', { name: /, / })).map(
      (n) => n.props.accessibilityLabel as string,
    );
    expect(names.slice(0, 3)).toEqual([
      'Antibiotics, partly checked · 1 of 4',
      'Pain relief, checked 3 days ago',
      'Cough syrups, checked 1 day ago',
    ]);
    expect(names).toContain('Balms, checked today');

    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: /^Pain relief/ }));
    expect(push).toHaveBeenCalledWith(`/check/${s.cat('Pain relief').id}`);
  });

  it('says never checked', async () => {
    const s = await seed();
    await renderRouter(routes(s.repos), { initialUrl: '/check' });
    expect(await screen.findByRole('button', { name: 'Balms, never checked' })).toBeOnTheScreen();
  });
});
