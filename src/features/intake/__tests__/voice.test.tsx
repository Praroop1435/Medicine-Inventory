import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { createMemoryRepos } from '@/data/memory/createMemoryRepos';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider } from '@/features/shared/Toast';
import type { SpeechEngine } from '@/services/speech/SpeechEngine';
import { tokens, T } from '@/ui';
import { useIntake } from '../IntakeContext';
import { NO_SPEECH_MS, SILENCE_MS, VoiceScreen } from '../screens/VoiceScreen';

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

function fake(available: boolean, said: string[], mic = true): SpeechEngine {
  let partial: (t: string) => void = () => {};
  return {
    getPermission: async () => (mic ? 'granted' : 'denied'),
    requestPermission: async () => mic,
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
  return renderRouter(
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

/** Tap to start, tap to stop: the fake engine "hears" the next phrase on stop. */
const speak = async () => {
  await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Stop listening' }));
};

beforeEach(() => mockStore.clear());

describe('voice screen', () => {
  it('shows what was heard, adds it to the list, then reviews both', async () => {
    await start(fake(true, ['Azithral 500 batch a1 expiry 11 26 2 cartons', 'Crocin batch b2']));
    expect(
      await screen.findByText('Tap and say: name, company, batch, expiry, quantity'),
    ).toBeOnTheScreen();
    await speak();
    expect(
      await screen.findByText('Azithral 500 batch a1 expiry 11 26 2 cartons'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Azithral 500')).toBeOnTheScreen();
    expect(screen.getByText('A1')).toBeOnTheScreen();
    expect(screen.getByText('Nov 2026')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to list' }));
    expect(await screen.findByText('Azithral 500 · A1 · 2')).toBeOnTheScreen();
    await speak();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add to list' }));
    expect(await screen.findByText('Crocin · B2 · —')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Review 2' }));
    expect(await screen.findByText('Review stub: A1,B2')).toBeOnTheScreen();
  });

  it('marks unsure or missing fields amber in the preview', async () => {
    await start(fake(true, ['Crocin batch b2']));
    await speak();
    const qty = await screen.findByText('Qty');
    expect(StyleSheet.flatten(qty.props.style).color).toBe(tokens.color.soon);
  });

  it('Try again listens afresh and drops the preview', async () => {
    await start(fake(true, ['Crocin batch b2', 'Dolo batch d1']));
    await speak();
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('button', { name: 'Add to list' })).toBeNull();
    expect(screen.getByText('Listening… tap to stop')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Stop listening' }));
    expect(await screen.findByText('Dolo batch d1')).toBeOnTheScreen();
  });

  it('removes a row', async () => {
    await start(fake(true, ['Crocin batch b2']));
    await speak();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add to list' }));
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

  it('explains the microphone once, and shows Open settings when it is off', async () => {
    const e = fake(true, [], false);
    await start(e);
    expect(
      await screen.findByText('The microphone is used to add stock by voice.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start listening' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText(
        'Microphone permission is off. Turn it on to add stock by voice, or use Type instead.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });

  it('toasts when the microphone is refused', async () => {
    const { PermissionDenied } = jest.requireActual('@/services/speech/SpeechEngine');
    const e = fake(true, []);
    e.start = async () => {
      throw new PermissionDenied();
    };
    await start(e);
    await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
    expect(
      await screen.findByText('Turn on the microphone to add stock by voice.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeOnTheScreen();
  });

  it('stops once start resolves when stop was tapped during the permission prompt', async () => {
    let open: () => void = () => {};
    const e = fake(true, ['Crocin batch b2']);
    e.start = () => new Promise<void>((r) => void (open = r));
    const stop = jest.spyOn(e, 'stop');
    await start(e);
    await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stop listening' }));
    expect(stop).not.toHaveBeenCalled();
    await act(async () => open());
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops the mic when the screen goes away while listening', async () => {
    const e = fake(true, []);
    const stop = jest.spyOn(e, 'stop');
    const r = await start(e);
    await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
    await screen.findByRole('button', { name: 'Stop listening' });
    await r.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops the mic when the screen goes away while still starting', async () => {
    let open: () => void = () => {};
    const e = fake(true, []);
    e.start = () => new Promise<void>((r) => void (open = r));
    const stop = jest.spyOn(e, 'stop');
    const r = await start(e);
    await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
    await r.unmount();
    expect(stop).not.toHaveBeenCalled();
    await act(async () => open());
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it(`stops by itself ${SILENCE_MS} ms after the last word`, async () => {
    let partial: (t: string) => void = () => {};
    const e = fake(true, []);
    e.start = async (p) => void (partial = p);
    e.stop = jest.fn(async () => 'Crocin batch b2');
    await start(e);
    await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
    await screen.findByText('Listening… tap to stop');
    jest.useFakeTimers();
    try {
      await act(async () => partial('Crocin batch b2'));
      expect(await screen.findByText('Crocin batch b2')).toBeOnTheScreen();
      await act(async () => jest.advanceTimersByTime(SILENCE_MS - 100));
      expect(e.stop).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTime(200));
      expect(e.stop).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
    expect(await screen.findByRole('button', { name: 'Add to list' })).toBeOnTheScreen();
  });

  it(`gives up after ${NO_SPEECH_MS} ms with nothing heard`, async () => {
    const e = fake(true, []);
    const stop = jest.spyOn(e, 'stop');
    await start(e);
    jest.useFakeTimers();
    try {
      await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
      await act(async () => jest.advanceTimersByTime(NO_SPEECH_MS + 10));
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
    expect(await screen.findByText("Didn't catch that. Tap and try again.")).toBeOnTheScreen();
  });

  /** Starts listening and returns the engine's own "I stopped" callback. */
  async function listen(e: SpeechEngine) {
    let partial: (t: string) => void = () => {};
    let end: (failed: boolean) => void = () => {};
    e.start = async (p, onEnd) => {
      partial = p;
      end = onEnd;
    };
    await start(e);
    await fireEvent.press(await screen.findByRole('button', { name: 'Start listening' }));
    await screen.findByText('Listening… tap to stop');
    return {
      partial: (t: string) => act(async () => partial(t)),
      end: (f: boolean) => act(async () => end(f)),
    };
  }

  it('goes back to idle when the engine stops by itself having heard nothing', async () => {
    const e = fake(true, []);
    const stop = jest.spyOn(e, 'stop');
    const { end } = await listen(e);
    await end(false);
    expect(await screen.findByText("Didn't catch that. Tap and try again.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeOnTheScreen();
    expect(screen.queryByText('Listening… tap to stop')).toBeNull();
    // It already stopped; asking it to stop again would wait for an end that never comes.
    expect(stop).not.toHaveBeenCalled();
  });

  it('shows what was heard when the engine stops by itself after speech', async () => {
    const { partial, end } = await listen(fake(true, []));
    await partial('Crocin batch b2');
    await end(false);
    expect(await screen.findByRole('button', { name: 'Add to list' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeOnTheScreen();
  });

  it('goes back to idle with a plain message when the engine fails', async () => {
    const { end } = await listen(fake(true, []));
    await end(true);
    expect(await screen.findByText('Voice stopped. Try again, or use Type.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeOnTheScreen();
    // The next tap starts afresh and clears the message.
    await fireEvent.press(screen.getByRole('button', { name: 'Start listening' }));
    expect(await screen.findByText('Listening… tap to stop')).toBeOnTheScreen();
  });

  it('shows how to say an entry', async () => {
    await start(fake(true, []));
    expect(
      await screen.findByText(
        'Azithral 500, Alembic, batch A Z 8 8, expiry November 2026, 10 strips',
      ),
    ).toBeOnTheScreen();
  });
});
