import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type { PermissionStatus } from '../Permission';
import { PermissionDenied, type SpeechEngine } from './SpeechEngine';

let last = '';
let starting = false;
let cancelled = false;
let subs: { remove(): void }[] = [];
const clear = () => {
  subs.forEach((s) => s.remove());
  subs = [];
};

export const nativeSpeechEngine: SpeechEngine = {
  isAvailable: async () => ExpoSpeechRecognitionModule.isRecognitionAvailable(),
  getPermission: async () =>
    (await ExpoSpeechRecognitionModule.getPermissionsAsync()).status as PermissionStatus,
  requestPermission: async () =>
    (await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted,
  async start(onPartial, onEnd) {
    starting = true;
    cancelled = false;
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync().finally(() => {
      starting = false;
    });
    if (!perm.granted) throw new PermissionDenied();
    if (cancelled) return; // stop() arrived while the permission prompt was open
    clear();
    last = '';
    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (e) => {
        last = e.results[0]?.transcript ?? last;
        onPartial(last);
      }),
      // Silence and no-match are endings, not failures; the screen says it didn't catch that.
      ExpoSpeechRecognitionModule.addListener('error', (e) => {
        clear();
        onEnd(!['no-speech', 'speech-timeout', 'aborted'].includes(e.error));
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        clear();
        onEnd(false);
      }),
    );
    ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true, continuous: true });
  },
  stop: () =>
    new Promise((resolve) => {
      if (starting) {
        cancelled = true;
        return resolve('');
      }
      // shortcut: 2s cap if the engine never emits `end`, fine until a device shows otherwise.
      const done = () => {
        clearTimeout(timer);
        end.remove();
        clear();
        resolve(last);
      };
      const end = ExpoSpeechRecognitionModule.addListener('end', done);
      const timer = setTimeout(done, 2000);
      ExpoSpeechRecognitionModule.stop();
    }),
};
