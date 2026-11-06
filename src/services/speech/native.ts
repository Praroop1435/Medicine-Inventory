import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { PermissionDenied, type SpeechEngine } from './SpeechEngine';

let last = '';
let subs: { remove(): void }[] = [];
const clear = () => {
  subs.forEach((s) => s.remove());
  subs = [];
};

export const nativeSpeechEngine: SpeechEngine = {
  isAvailable: async () => ExpoSpeechRecognitionModule.isRecognitionAvailable(),
  async start(onPartial) {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new PermissionDenied();
    clear();
    last = '';
    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (e) => {
        last = e.results[0]?.transcript ?? last;
        onPartial(last);
      }),
    );
    ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true, continuous: true });
  },
  stop: () =>
    new Promise((resolve) => {
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
