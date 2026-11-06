import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import { emptyDraft } from '@/domain/draft';
import type { Category } from '@/domain/types';
import type { Notifier } from '@/services/notifications/Notifier';
import { T } from '@/ui';
import { AppShell } from '../AppShell';
import TabsLayout from '../../../../app/(tabs)/_layout';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const DAY = 86_400_000;
const TODAY = new Date(2026, 10, 6);
type Sent = { time: string; title: string; body: string; data: Record<string, string> };
type Morning = { at: Date; title: string; body: string; data: Record<string, string> };

function fakeNotifier() {
  const scheduled = new Map<string, Sent>();
  let mornings: Morning[] = [];
  let tap: (d: Record<string, string>) => void = () => {};
  const notifier: Notifier = {
    getPermission: async () => 'granted',
    requestPermission: async () => true,
    scheduleDaily: jest.fn(async (id, time, title, body, data) => {
      scheduled.set(id, { time, title, body, data });
    }),
    scheduleMornings: jest.fn(async (list) => void (mornings = list)),
    cancel: jest.fn(async (id) => {
      scheduled.delete(id);
      if (id === 'morning') mornings = [];
    }),
    onTap: (cb) => {
      tap = cb;
      return () => {};
    },
  };
  return {
    notifier,
    scheduled,
    mornings: () => mornings,
    tap: (d: Record<string, string>) => tap(d),
  };
}

async function seed() {
  const repos = createMemoryRepos(() => TODAY.getTime());
  const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
  let cats: Category[] = [];
  repos.inventory.watchCategories(shopId, (c) => (cats = c))();
  for (const c of cats)
    await repos.inventory.upsertCategory(shopId, { ...c, lastCheckedAt: TODAY.getTime() - DAY });
  const cough = cats.find((c) => c.name === 'Cough syrups')!;
  await repos.inventory.upsertCategory(shopId, {
    ...cough,
    lastCheckedAt: TODAY.getTime() - 18 * DAY,
  });
  const add = (batchNo: string, month: number) =>
    repos.inventory.saveIntake(
      shopId,
      [
        {
          ...emptyDraft('manual'),
          medicineName: `Med ${batchNo}`,
          companyName: 'Cipla',
          categoryId: cough.id,
          unit: 'strip',
          batchNo,
          expiry: { year: 2026, month },
          qty: 3,
        },
      ],
      null,
      deviceId,
    );
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
  return { repos, shopId, deviceId, cough, add };
}

async function open(repos: ReturnType<typeof createMemoryRepos>, notifier: Notifier) {
  return renderRouter(
    {
      _layout: () => <AppShell repos={repos} notifier={notifier} />,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': () => <T>Home stub</T>,
      '(tabs)/stock': () => null,
      '(tabs)/check': () => <T>Check stub</T>,
      '(tabs)/settings': () => null,
      'alerts/[status]': () => <T>Alerts stub</T>,
      'check/[categoryId]': () => <T>Check folder stub</T>,
    },
    { initialUrl: '/' },
  );
}

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
afterEach(() => jest.useRealTimers());

const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m);

describe('useDailyAlert', () => {
  it("schedules the next 7 mornings, each with that day's counts, and the night reminder", async () => {
    const { repos, shopId, deviceId, cough, add } = await seed();
    await repos.shop.updateShop(shopId, { alertDays: { first: 90, second: 20 } }, deviceId);
    await add('S1', 11); // ends Nov 30: within 90 days until Nov 9, within 20 from Nov 10
    const f = fakeNotifier();
    await open(repos, f.notifier);

    // It is 10:00, so today's 09:00 has passed: Nov 7 to Nov 13.
    await waitFor(() => expect(f.mornings()).toHaveLength(7));
    expect(f.mornings().map((x) => x.at)).toEqual(
      [7, 8, 9, 10, 11, 12, 13].map((d) => at(d, 9, 0)),
    );
    expect(f.mornings()[0]).toEqual({
      at: at(7, 9, 0),
      title: 'Expiry alert',
      body: '1 expires within 90 days',
      data: { url: '/alerts/watch' },
    });
    expect(f.mornings()[2].body).toBe('1 expires within 90 days');
    expect(f.mornings()[3]).toMatchObject({
      body: '1 expires within 20 days',
      data: { url: '/alerts/soon' },
    });
    expect(f.scheduled.get('night')).toEqual({
      time: '21:00',
      title: 'Stock update',
      body: "Time for tonight's stock update — mark what was sold today. Due: Cough syrups (not checked for 18 days).",
      data: { url: `/check/${cough.id}` },
    });
  });

  it('reschedules when counts or times change, and cancels the morning alerts when nothing is due', async () => {
    const { repos, shopId, deviceId, add } = await seed();
    await add('S1', 11);
    const f = fakeNotifier();
    await open(repos, f.notifier);
    await waitFor(() => expect(f.mornings()[0]?.body).toBe('1 expires within 30 days'));

    await act(() => add('E1', 9)); // expired
    await waitFor(() =>
      expect(f.mornings()[0]).toMatchObject({
        body: '1 expired · 1 expires within 30 days',
        data: { url: '/alerts/expired' },
      }),
    );

    await act(() =>
      repos.shop.updateShop(shopId, { notifyTime: '10:15', nightTime: '22:30' }, deviceId),
    );
    // 10:15 is still ahead today.
    await waitFor(() => expect(f.mornings()[0]?.at).toEqual(at(6, 10, 15)));
    expect(f.scheduled.get('night')?.time).toBe('22:30');

    let ids: string[] = [];
    repos.inventory.watchLiveBatches(shopId, (b) => (ids = b.map((x) => x.id)))();
    for (const id of ids) await act(() => repos.inventory.markReturned(shopId, id, deviceId));
    await waitFor(() => expect(f.mornings()).toEqual([]));
    expect(f.notifier.cancel).toHaveBeenCalledWith('morning');
    expect(f.scheduled.has('night')).toBe(true);
  });

  it('cancels both reminders when there is no shop on this phone', async () => {
    const repos = createMemoryRepos(() => TODAY.getTime());
    const f = fakeNotifier();
    await renderRouter(
      {
        _layout: () => <AppShell repos={repos} notifier={f.notifier} />,
        '(tabs)/_layout': TabsLayout,
        '(tabs)/index': () => <T>Home stub</T>,
        'onboarding/index': () => <T>Welcome stub</T>,
      },
      { initialUrl: '/' },
    );
    expect(await screen.findByText('Welcome stub')).toBeOnTheScreen();
    await waitFor(() => expect(f.notifier.cancel).toHaveBeenCalledWith('morning'));
    expect(f.notifier.cancel).toHaveBeenCalledWith('night');
    expect(f.notifier.scheduleDaily).not.toHaveBeenCalled();
    expect(f.notifier.scheduleMornings).not.toHaveBeenCalled();
  });

  it('opens the screen a tapped reminder points to', async () => {
    const { repos } = await seed();
    const f = fakeNotifier();
    const r = await open(repos, f.notifier);
    await screen.findByText('Home stub');
    await act(async () => f.tap({ url: '/alerts/expired' }));
    expect(await screen.findByText('Alerts stub')).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/alerts/expired');
  });
});
