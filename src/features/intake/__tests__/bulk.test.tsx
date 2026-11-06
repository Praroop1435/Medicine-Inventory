import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { getDocumentAsync } from 'expo-document-picker';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import { readSheetFile } from '@/services/bulk/template';
import { T } from '@/ui';
import { useIntake } from '../IntakeContext';
import BulkRoute from '../../../../app/intake/bulk';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/services/bulk/template', () => ({
  readSheetFile: jest.fn(),
  shareTemplate: jest.fn(),
}));

const pick = jest.mocked(getDocumentAsync);
const read = jest.mocked(readSheetFile);
const H = ['category', 'company', 'medicine', 'unit', 'batch', 'expiry', 'qty'];
const good = ['', 'Alembic', 'Azithral 500', 'carton', 'AZ88', '11/26', '2'];
const bad = ['', 'Alembic', 'Okacet 10', 'strip', 'C2', '13/26', '1'];

function ReviewStub() {
  const { drafts } = useIntake();
  return <T>{`Review stub: ${drafts.length}`}</T>;
}

async function start() {
  let t = 1;
  const repos = createMemoryRepos(() => t++);
  const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Ravi');
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Ravi' }));
  await renderRouter(
    {
      _layout: () => (
        <ToastProvider>
          <AppShell repos={repos} />
        </ToastProvider>
      ),
      index: BulkRoute,
      'intake/review': ReviewStub,
    },
    { initialUrl: '/' },
  );
  await screen.findByText('Bulk import');
}

const choose = (rows: string[][]) => {
  pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x.csv' }] } as never);
  read.mockResolvedValue(rows);
};
const pressPick = async () => fireEvent.press(screen.getByRole('button', { name: 'Pick file' }));

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe('bulk screen', () => {
  it('lists bad rows and reviews only the good ones', async () => {
    await start();
    choose([H, good, bad]);
    await pressPick();
    expect(await screen.findByText('Row 3: Expiry not readable')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Review 1 good row' }));
    expect(await screen.findByText('Review stub: 1')).toBeOnTheScreen();
  });

  it('goes straight to review when every row is good', async () => {
    await start();
    choose([H, good]);
    await pressPick();
    expect(await screen.findByText('Review stub: 1')).toBeOnTheScreen();
  });

  it('does nothing when the picker is cancelled', async () => {
    await start();
    pick.mockResolvedValue({ canceled: true, assets: null } as never);
    await pressPick();
    expect(read).not.toHaveBeenCalled();
    expect(screen.getByText('Bulk import')).toBeOnTheScreen();
  });

  it('shows a plain message when the file cannot be read', async () => {
    await start();
    pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x' }] } as never);
    read.mockRejectedValue(new Error('boom'));
    await pressPick();
    expect(
      await screen.findByText("Couldn't read this file. Save it as .xlsx or .csv and try again."),
    ).toBeOnTheScreen();
  });
});
