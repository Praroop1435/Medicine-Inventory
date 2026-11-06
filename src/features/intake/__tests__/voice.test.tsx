import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import type { SpeechEngine } from '@/services/speech/SpeechEngine';
import { T } from '@/ui';
import { useIntake } from '../IntakeContext';
import { VoiceScreen } from '../screens/VoiceScreen';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));
jest.mock('@/services/speech/native', () => ({ nativeSpeechEngine: {} }));

function ReviewStub() {
  const { drafts } = useIntake();
  return <T>{`Review stub: ${drafts.map((d) => d.batchNo).join(',')}`}</T>;
}

function fake(available: boolean, said: string[]): SpeechEngine {
  let partial: (t: string) => void = () => {};
  return {
    isAvailable: async () => available,
    start: async (p) => void (partial = p),
    stop: async () => {
      const t = said.shift() ?? '';
      partial(t);
      return t;
    },
  };
}

async function start(engine: SpeechEngine) {
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
      index: () => <VoiceScreen engine={engine} />,
      'intake/review': ReviewStub,
      'intake/manual': () => <T>Manual stub</T>,
    },
    { initialUrl: '/' },
  );
}

const speak = async () => {
  const mic = await screen.findByRole('button', { name: 'Hold to speak' });
  await fireEvent(mic, 'pressIn');
  await fireEvent(mic, 'pressOut');
};

beforeEach(() => mockStore.clear());

describe('voice screen', () => {
  it('appends two entries then reviews both', async () => {
    await start(fake(true, ['Azithral 500 batch a1 expiry 11 26 2 cartons', 'Crocin batch b2']));
    await speak();
    expect(
      await screen.findByText('Azithral 500 batch a1 expiry 11 26 2 cartons'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Azithral 500 · A1 · 2')).toBeOnTheScreen();
    await speak();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Crocin · B2 · —')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Review 2' }));
    expect(await screen.findByText('Review stub: A1,B2')).toBeOnTheScreen();
  });

  it('removes a row', async () => {
    await start(fake(true, ['Crocin batch b2']));
    await speak();
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Crocin' }));
    expect(screen.queryByText('Crocin · B2 · —')).toBeNull();
  });

  it('offers typing when voice is unavailable', async () => {
    await start(fake(false, []));
    expect(
      await screen.findByText("Voice isn't available right now. Use Type instead."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Type instead' }));
    expect(await screen.findByText('Manual stub')).toBeOnTheScreen();
  });

  it('toasts when the microphone is refused', async () => {
    const { PermissionDenied } = jest.requireActual('@/services/speech/SpeechEngine');
    const e = fake(true, []);
    e.start = async () => {
      throw new PermissionDenied();
    };
    await start(e);
    await speak();
    expect(await screen.findByText('Microphone permission is needed for voice')).toBeOnTheScreen();
  });

  it('stops once start resolves when released during the permission prompt', async () => {
    let open: () => void = () => {};
    const e = fake(true, ['Crocin batch b2']);
    e.start = () => new Promise<void>((r) => void (open = r));
    const stop = jest.spyOn(e, 'stop');
    await start(e);
    const mic = await screen.findByRole('button', { name: 'Hold to speak' });
    await fireEvent(mic, 'pressIn');
    await fireEvent(mic, 'pressOut');
    expect(stop).not.toHaveBeenCalled();
    await act(async () => open());
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops after a quick tap', async () => {
    const e = fake(true, ['Crocin batch b2']);
    const stop = jest.spyOn(e, 'stop');
    await start(e);
    await speak();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('toggles listening on a bare press for screen readers', async () => {
    const e = fake(true, ['Crocin batch b2']);
    const startSpy = jest.spyOn(e, 'start');
    const stop = jest.spyOn(e, 'stop');
    await start(e);
    const mic = await screen.findByRole('button', { name: 'Hold to speak' });
    await fireEvent.press(mic);
    expect(startSpy).toHaveBeenCalledTimes(1);
    await fireEvent.press(mic);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
