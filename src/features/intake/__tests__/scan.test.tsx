import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import type { OcrEngine, OcrLine } from '@/services/ocr/OcrEngine';
import { T } from '@/ui';
import { useIntake } from '../IntakeContext';
import { ScanScreen } from '../screens/ScanScreen';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));
jest.mock('@/services/ocr/mlkit', () => ({ mlkitOcrEngine: {} }));
let mockGranted = true;
jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    useCameraPermissions: () => [{ granted: mockGranted }, jest.fn()],
    CameraView: forwardRef((_p: unknown, ref: unknown) => {
      useImperativeHandle(ref, () => ({
        takePictureAsync: async () => ({ uri: 'file:///cache/bill.jpg' }),
      }));
      return null;
    }),
  };
});
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: async () => ({
    canceled: false,
    assets: [{ uri: 'file:///cache/pick.jpg' }],
  }),
}));

function ReviewStub() {
  const { drafts, bill } = useIntake();
  return <T>{`Review stub: ${drafts.length} from ${bill?.supplier} #${bill?.billNo}`}</T>;
}

const row = (top: number, ...cells: string[]): OcrLine[] =>
  cells.map((text, i) => ({ text, top, left: 40 + i * 100 }));
const GOOD: OcrLine[] = [
  ...row(10, 'RAJ PHARMA'),
  ...row(40, 'Bill No: INV-9'),
  ...row(100, 'Crocin', 'CR45A', '08/27', '20'),
  ...row(130, 'Dolo', 'DL1', '03/28', '5'),
];

async function start(lines: OcrLine[] | Error) {
  const engine: OcrEngine = {
    recognize: async () => {
      if (lines instanceof Error) throw lines;
      return lines;
    },
  };
  const repos = createMemoryRepos(() => 1);
  const { shopId, deviceId } = await repos.shop.createShop('Anand Medicals', 'Ravi');
  mockStore.set('session', JSON.stringify({ shopId, deviceId, displayName: 'Ravi' }));
  await renderRouter(
    {
      _layout: () => (
        <ToastProvider>
          <AppShell repos={repos} />
        </ToastProvider>
      ),
      index: () => <ScanScreen engine={engine} />,
      'intake/review': ReviewStub,
      'intake/manual': () => <T>Manual stub</T>,
    },
    { initialUrl: '/' },
  );
}

beforeEach(() => {
  mockStore.clear();
  mockGranted = true;
});

describe('scan screen', () => {
  it('captures, reads, and opens review with drafts and header', async () => {
    await start(GOOD);
    await fireEvent.press(await screen.findByRole('button', { name: 'Capture' }));
    expect(await screen.findByText('Review stub: 2 from RAJ PHARMA #INV-9')).toBeOnTheScreen();
  });

  it('picks from gallery', async () => {
    await start(GOOD);
    await fireEvent.press(await screen.findByRole('button', { name: 'Pick from gallery' }));
    expect(await screen.findByText(/Review stub: 2/)).toBeOnTheScreen();
  });

  it('shows a message and Retake when nothing is read', async () => {
    await start(row(10, 'blurry'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Capture' }));
    expect(
      await screen.findByText(
        "Couldn't read any medicines. Try again with better light, or type them.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retake' }));
    expect(await screen.findByRole('button', { name: 'Capture' })).toBeOnTheScreen();
  });

  it('still offers the gallery when the camera is denied', async () => {
    mockGranted = false;
    await start(GOOD);
    expect(await screen.findByText(/Camera permission is off/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Pick from gallery' }));
    expect(await screen.findByText(/Review stub: 2/)).toBeOnTheScreen();
  });

  it('distinguishes an engine failure from zero rows', async () => {
    await start(new Error('boom'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Capture' }));
    expect(await screen.findByText("Couldn't read the photo. Try again.")).toBeOnTheScreen();
  });
});
