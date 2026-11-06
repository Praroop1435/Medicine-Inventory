import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { Device } from '@/domain/types';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Repos } from '@/data/repositories';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import { JoinScreen } from '../screens/JoinScreen';
import TabsLayout from '../../../../app/(tabs)/_layout';
import Home from '../../../../app/(tabs)/index';
import Stock from '../../../../app/(tabs)/stock';
import Check from '../../../../app/(tabs)/check';
import Settings from '../../../../app/(tabs)/settings';
import Welcome from '../../../../app/onboarding/index';
import Setup from '../../../../app/onboarding/setup';
import Qr from '../../../../app/onboarding/qr';
import Name from '../../../../app/onboarding/name';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const routes = (repos: Repos, scanned = '') => ({
  _layout: () => (
    <ToastProvider>
      <AppShell repos={repos} />
    </ToastProvider>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Home,
  '(tabs)/stock': Stock,
  '(tabs)/check': Check,
  '(tabs)/settings': Settings,
  'onboarding/index': Welcome,
  'onboarding/setup': Setup,
  'onboarding/qr': Qr,
  'onboarding/join': () => <JoinScreen scanned={scanned} />,
  'onboarding/name': Name,
});

const devices = (repos: Repos, shopId: string) => {
  let out: Device[] = [];
  repos.shop.watchDevices(shopId, (d) => (out = d))();
  return out;
};

beforeEach(() => mockStore.clear());
afterEach(() => jest.restoreAllMocks());

describe('onboarding', () => {
  it('sets up a shop, holds on the QR screen until "I saved it", then shows the tabs', async () => {
    const repos = createMemoryRepos();
    const r = await renderRouter(routes(repos), { initialUrl: '/' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Set up shop' }));
    await fireEvent.changeText(screen.getByLabelText('Shop name'), 'Anand Medicals');
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Priya');
    await fireEvent.press(screen.getByRole('button', { name: 'Create shop' }));

    expect(
      await screen.findByText(
        'This QR is the only way back into your shop if every phone is lost. Save or print it.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save QR image' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/onboarding/qr');
    expect(screen.queryByRole('header', { name: 'Anand Medicals' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'I saved it' }));
    expect(await screen.findByRole('header', { name: 'Anand Medicals' })).toBeOnTheScreen();

    const session = JSON.parse(mockStore.get('session') ?? 'null');
    expect(session).toMatchObject({ displayName: 'Priya' });
    expect(devices(repos, session.shopId).map((d) => d.displayName)).toEqual(['Priya']);
  });

  it('joins a shop from a scanned QR, asks the name, then shows the tabs', async () => {
    const repos = createMemoryRepos();
    const { shopId, joinSecret } = await repos.shop.createShop('Anand Medicals', 'Priya');
    const payload = JSON.stringify({ v: 1, shopId, joinSecret });
    await renderRouter(routes(repos, payload), { initialUrl: '/onboarding' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Join shop' }));
    await fireEvent.changeText(await screen.findByLabelText('Your name'), 'Ravi');
    await fireEvent.press(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByRole('header', { name: 'Anand Medicals' })).toBeOnTheScreen();
    expect(devices(repos, shopId).map((d) => d.displayName)).toEqual(['Priya', 'Ravi']);
    expect(JSON.parse(mockStore.get('session') ?? 'null')).toMatchObject({
      shopId,
      displayName: 'Ravi',
    });
  });

  it('rejects a QR code that is not a shop QR', async () => {
    await renderRouter(routes(createMemoryRepos(), '{"v":2,"shopId":"x"}'), {
      initialUrl: '/onboarding/join',
    });
    expect(await screen.findByText("This isn't a shop QR code")).toBeOnTheScreen();
  });

  it('shows a failed createShop inline instead of crashing', async () => {
    const repos = createMemoryRepos();
    jest.spyOn(repos.shop, 'createShop').mockRejectedValue(new Error('You are offline'));
    await renderRouter(routes(repos), { initialUrl: '/onboarding/setup' });
    await fireEvent.changeText(await screen.findByLabelText('Shop name'), 'Anand Medicals');
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Priya');
    await fireEvent.press(screen.getByRole('button', { name: 'Create shop' }));
    expect(await screen.findByText('You are offline')).toBeOnTheScreen();
  });

  it('goes straight to the tabs for a saved session without joining again', async () => {
    const repos = createMemoryRepos();
    const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
    mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
    const join = jest.spyOn(repos.shop, 'joinShop');
    await renderRouter(routes(repos), { initialUrl: '/' });
    expect(await screen.findByRole('header', { name: 'Anand Medicals' })).toBeOnTheScreen();
    expect(join).not.toHaveBeenCalled();
  });

  it('Add opens a sheet whose rows push the intake routes', async () => {
    const repos = createMemoryRepos();
    const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
    mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
    await renderRouter(routes(repos), { initialUrl: '/' });
    // The router binds its methods on render, so spy afterwards.
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});

    const rows = [
      ['Scan bill', '/intake/scan'],
      ['Speak', '/intake/voice'],
      ['Type', '/intake/manual'],
      ['Bulk import', '/intake/bulk'],
    ];
    for (const [label, href] of rows) {
      await fireEvent.press(await screen.findByRole('button', { name: 'Add' }));
      await fireEvent.press(await screen.findByRole('button', { name: label }));
      expect(push).toHaveBeenLastCalledWith(href);
    }
  });
});
