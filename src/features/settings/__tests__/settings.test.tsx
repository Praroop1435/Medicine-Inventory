import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import type { Device, Shop } from '@/domain/types';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import type { Notifier } from '@/services/notifications/Notifier';
import { silentNotifier } from '@/services/notifications/Notifier';
import Settings from '../../../../app/(tabs)/settings';
import SettingsQr from '../../../../app/settings/qr';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

const RECOVERY =
  'This QR is the only way back into your shop if every phone is lost. Save or print it.';

async function open(
  notifier: Notifier = { ...silentNotifier, getPermission: async () => 'granted' },
) {
  const repos = createMemoryRepos();
  const { shopId, deviceId, joinSecret } = await repos.shop.createShop('Anand Medicals', 'Priya');
  const { deviceId: raviId } = await repos.shop.joinShop(shopId, joinSecret, 'Ravi');
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
  const r = await renderRouter(
    {
      _layout: () => (
        <ToastProvider>
          <AppShell repos={repos} notifier={notifier} />
        </ToastProvider>
      ),
      index: Settings,
      'settings/qr': SettingsQr,
      'onboarding/index': () => null,
    },
    { initialUrl: '/' },
  );
  await screen.findByLabelText('First warning (days)');
  const shop = () => {
    let s: Shop | null = null;
    repos.shop.watchShop(shopId, (x) => (s = x))();
    return s!;
  };
  const devices = () => {
    let d: Device[] = [];
    repos.shop.watchDevices(shopId, (x) => (d = x))();
    return d;
  };
  return { r, repos, shopId, deviceId, raviId, joinSecret, shop, devices };
}

beforeEach(() => mockStore.clear());
afterEach(() => jest.restoreAllMocks());

describe('settings', () => {
  it('shows only the four sections', async () => {
    await open();
    const headers = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headers).toEqual(
      expect.arrayContaining(['Reminders', 'Phones', "This phone's name", 'App']),
    );
    expect(screen.queryByText(/categor|compan/i)).toBeNull();
  });

  describe('reminders', () => {
    it('starts from the shop values', async () => {
      await open();
      expect(screen.getByLabelText('First warning (days)').props.value).toBe('90');
      expect(screen.getByLabelText('Second warning (days)').props.value).toBe('30');
      expect(screen.getByLabelText('Morning alert time').props.value).toBe('09:00');
      expect(screen.getByLabelText('Night reminder time').props.value).toBe('21:00');
    });

    it('rejects a second warning that is not fewer days than the first', async () => {
      const { shop } = await open();
      await fireEvent.changeText(screen.getByLabelText('Second warning (days)'), '90');
      await fireEvent.press(screen.getByRole('button', { name: 'Save reminders' }));
      expect(
        await screen.findByText('Second alert must be fewer days than first'),
      ).toBeOnTheScreen();
      expect(shop().alertDays).toEqual({ first: 90, second: 30 });
    });

    it('rejects a time outside 00:00–23:59', async () => {
      const { shop } = await open();
      await fireEvent.changeText(screen.getByLabelText('Night reminder time'), '24:00');
      await fireEvent.press(screen.getByRole('button', { name: 'Save reminders' }));
      expect(await screen.findByText('Times must be HH:MM, from 00:00 to 23:59')).toBeOnTheScreen();
      expect(shop().nightTime).toBe('21:00');
    });

    it('saves days and both times to the shop', async () => {
      const { shop } = await open();
      await fireEvent.changeText(screen.getByLabelText('First warning (days)'), '60');
      await fireEvent.changeText(screen.getByLabelText('Second warning (days)'), '15');
      await fireEvent.changeText(screen.getByLabelText('Morning alert time'), '08:30');
      await fireEvent.changeText(screen.getByLabelText('Night reminder time'), '22:15');
      await fireEvent.press(screen.getByRole('button', { name: 'Save reminders' }));
      await waitFor(() =>
        expect(shop()).toMatchObject({
          alertDays: { first: 60, second: 15 },
          notifyTime: '08:30',
          nightTime: '22:15',
        }),
      );
      expect(await screen.findByText('Reminders saved')).toBeOnTheScreen();
    });

    it('says when notifications are off and Turn on falls back to Android settings', async () => {
      const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
      const notifier = { ...silentNotifier, requestPermission: jest.fn(async () => false) };
      await open(notifier);
      expect(await screen.findByText('Notifications are off')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Turn on' }));
      expect(notifier.requestPermission).toHaveBeenCalled();
      expect(openSettings).toHaveBeenCalled();
    });

    it('hides the notifications row once allowed', async () => {
      await open();
      expect(screen.queryByText('Notifications are off')).toBeNull();
    });
  });

  describe('phones', () => {
    it('lists phones and marks this one', async () => {
      await open();
      expect(await screen.findByText('Priya (this phone)')).toBeOnTheScreen();
      expect(screen.getByText('Ravi')).toBeOnTheScreen();
    });

    it('asks before removing a phone; Cancel keeps it', async () => {
      const { devices, raviId, repos } = await open();
      const remove = jest.spyOn(repos.shop, 'removeDevice');
      await fireEvent.press(await screen.findByRole('button', { name: 'Remove' }));
      const dialog = await screen.findByTestId('confirm-dialog');
      expect(within(dialog).getByText('Remove Ravi?')).toBeOnTheScreen();
      expect(within(dialog).getByText('It loses access to the shop.')).toBeOnTheScreen();
      await fireEvent.press(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(remove).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
      await fireEvent.press(
        within(await screen.findByTestId('confirm-dialog')).getByRole('button', { name: 'Remove' }),
      );
      await waitFor(() => expect(devices().find((d) => d.id === raviId)?.removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('Ravi')).toBeNull());
    });

    it("removing a phone makes a new join code by default, so a lost phone's QR stops working", async () => {
      const { r, shop, joinSecret, raviId, devices } = await open();
      await fireEvent.press(await screen.findByRole('button', { name: 'Remove' }));
      const dialog = await screen.findByTestId('confirm-dialog');
      const box = within(dialog).getByRole('checkbox', { name: 'Also make a new join code' });
      expect(box).toBeChecked();
      await fireEvent.press(within(dialog).getByRole('button', { name: 'Remove' }));
      await waitFor(() => expect(shop().joinSecret).not.toBe(joinSecret));
      expect(devices().find((d) => d.id === raviId)?.removed).toBe(true);
      expect(await screen.findByText(RECOVERY)).toBeOnTheScreen();
      expect(r.getPathname()).toBe('/settings/qr');
    });

    it('the new join code can be turned off when removing a phone', async () => {
      const { shop, joinSecret, raviId, devices } = await open();
      await fireEvent.press(await screen.findByRole('button', { name: 'Remove' }));
      const dialog = await screen.findByTestId('confirm-dialog');
      await fireEvent.press(
        within(dialog).getByRole('checkbox', { name: 'Also make a new join code' }),
      );
      expect(within(dialog).getByRole('checkbox')).not.toBeChecked();
      await fireEvent.press(within(dialog).getByRole('button', { name: 'Remove' }));
      await waitFor(() => expect(devices().find((d) => d.id === raviId)?.removed).toBe(true));
      expect(shop().joinSecret).toBe(joinSecret);
    });

    it('Save QR image waits for the shop to load', async () => {
      const repos = createMemoryRepos();
      const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Priya');
      mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Priya' }));
      jest.spyOn(repos.shop, 'watchShop').mockReturnValue(() => {});
      await renderRouter(
        { _layout: () => <AppShell repos={repos} />, index: SettingsQr },
        { initialUrl: '/' },
      );
      expect(await screen.findByRole('button', { name: 'Save QR image' })).toBeDisabled();
    });

    it('shows the join QR with the recovery-key sentence', async () => {
      const { r } = await open();
      await fireEvent.press(screen.getByRole('button', { name: 'Show join QR' }));
      expect(await screen.findByText(RECOVERY)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Save QR image' })).toBeEnabled();
      expect(r.getPathname()).toBe('/settings/qr');
    });

    it('New join code asks, rotates the secret and shows the new QR', async () => {
      const { r, shop, joinSecret } = await open();
      await fireEvent.press(screen.getByRole('button', { name: 'New join code' }));
      const dialog = await screen.findByTestId('confirm-dialog');
      await fireEvent.press(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(shop().joinSecret).toBe(joinSecret);

      await fireEvent.press(screen.getByRole('button', { name: 'New join code' }));
      await fireEvent.press(
        within(await screen.findByTestId('confirm-dialog')).getByRole('button', {
          name: 'New code',
        }),
      );
      expect(await screen.findByText(RECOVERY)).toBeOnTheScreen();
      expect(r.getPathname()).toBe('/settings/qr');
      expect(shop().joinSecret).not.toBe(joinSecret);
    });
  });

  it('when another phone removes this one, it says so once, forgets the shop and goes to onboarding', async () => {
    const { r, repos, shopId, deviceId, raviId } = await open();
    await act(() => repos.shop.removeDevice(shopId, deviceId, raviId));
    expect(await screen.findByText('This phone was removed from the shop.')).toBeOnTheScreen();
    await waitFor(() => expect(r.getPathname()).toBe('/onboarding'));
    expect(mockStore.has('session')).toBe(false);
  });

  it('renames this phone and updates the saved session', async () => {
    const { devices, deviceId } = await open();
    expect(screen.getByLabelText('Phone name').props.value).toBe('Priya');
    await fireEvent.changeText(screen.getByLabelText('Phone name'), '  Priya counter ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() =>
      expect(devices().find((d) => d.id === deviceId)?.displayName).toBe('Priya counter'),
    );
    expect(JSON.parse(mockStore.get('session')!).displayName).toBe('Priya counter');
    expect(await screen.findByText('Priya counter (this phone)')).toBeOnTheScreen();
  });

  it('shows the version and says when this build gets no updates', async () => {
    await open();
    expect(screen.getByText('Version')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Check for update' }));
    expect(await screen.findByText("This build doesn't get updates")).toBeOnTheScreen();
  });
});
