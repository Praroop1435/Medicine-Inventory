import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { Permission, PermissionStatus } from '@/services/Permission';
import { T } from '@/ui';
import { PermissionPrompt, usePermissionGate } from '../PermissionGate';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

function fake(status: PermissionStatus, grants: boolean) {
  const p: Permission & { status: PermissionStatus } = {
    status,
    getPermission: jest.fn(async () => p.status),
    requestPermission: jest.fn(async () => {
      p.status = grants ? 'granted' : 'denied';
      return grants;
    }),
  };
  return p;
}

function Host({ source }: { source: Permission }) {
  const gate = usePermissionGate('camera', source);
  return gate.state === 'granted' ? (
    <T>Camera on</T>
  ) : (
    <PermissionPrompt
      gate={gate}
      reason="Used to photograph bills."
      off="Camera permission is off."
    />
  );
}

beforeEach(() => mockStore.clear());
afterEach(() => jest.restoreAllMocks());

describe('permission gate', () => {
  it('explains once before the system prompt, then opens the feature', async () => {
    const source = fake('undetermined', true);
    await render(<Host source={source} />);
    expect(await screen.findByText('Used to photograph bills.')).toBeOnTheScreen();
    expect(source.requestPermission).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Camera on')).toBeOnTheScreen();
    expect(source.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not explain again once seen; denied shows what is off and Open settings', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const source = fake('undetermined', false);
    const first = await render(<Host source={source} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Camera permission is off.')).toBeOnTheScreen();
    await first.unmount();

    await render(<Host source={source} />);
    expect(await screen.findByText('Camera permission is off.')).toBeOnTheScreen();
    expect(screen.queryByText('Used to photograph bills.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
    // Asks the OS again first; settings only because it still says no.
    expect(source.requestPermission).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalled();
  });

  it('Open settings re-requests first and skips settings when the OS now allows it', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    open.mockClear(); // Linking is already a jest mock, so restoreAllMocks keeps its old calls
    mockStore.set('permission-seen-camera', '1');
    const source = fake('denied', true);
    await render(<Host source={source} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open settings' }));
    expect(await screen.findByText('Camera on')).toBeOnTheScreen();
    expect(source.requestPermission).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('goes straight to the feature when already allowed', async () => {
    await render(<Host source={fake('granted', true)} />);
    expect(await screen.findByText('Camera on')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });
});
