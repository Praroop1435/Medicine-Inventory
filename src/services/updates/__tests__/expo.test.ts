import * as Updates from 'expo-updates';
import { expoUpdater } from '../expo';

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));
const mocked = Updates as jest.Mocked<typeof Updates> & { isEnabled: boolean };

describe('expoUpdater', () => {
  const dev = __DEV__;
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.isEnabled = true;
    (global as unknown as { __DEV__: boolean }).__DEV__ = false;
  });
  afterAll(() => ((global as unknown as { __DEV__: boolean }).__DEV__ = dev));

  it('does nothing when updates are off (dev client, Jest)', async () => {
    mocked.isEnabled = false;
    expect(await expoUpdater.check()).toBe('unavailable');
    expect(mocked.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('says latest when there is nothing new', async () => {
    mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: false } as never);
    expect(await expoUpdater.check()).toBe('latest');
    expect(mocked.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('downloads and reloads when an update is found', async () => {
    mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    mocked.fetchUpdateAsync.mockResolvedValue({ isNew: true } as never);
    await expoUpdater.check();
    expect(mocked.fetchUpdateAsync).toHaveBeenCalled();
    expect(mocked.reloadAsync).toHaveBeenCalled();
  });
});
