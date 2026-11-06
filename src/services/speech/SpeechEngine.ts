import type { Permission } from '../Permission';

/** The Permission part is the microphone. */
export interface SpeechEngine extends Permission {
  isAvailable(): Promise<boolean>;
  /**
   * Rejects with PermissionDenied when the microphone is refused. `onEnd` fires when listening
   * ends without stop() (silence, no match, OS timeout); `failed` when it ended on an error.
   */
  start(onPartial: (t: string) => void, onEnd: (failed: boolean) => void): Promise<void>;
  /** Ends listening and resolves with the final transcript. */
  stop(): Promise<string>;
}

export class PermissionDenied extends Error {
  constructor() {
    super('Microphone permission denied');
  }
}
