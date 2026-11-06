import type { Permission } from '../Permission';

/** The Permission part is the microphone. */
export interface SpeechEngine extends Permission {
  isAvailable(): Promise<boolean>;
  /** Rejects with PermissionDenied when the microphone is refused. */
  start(onPartial: (t: string) => void): Promise<void>;
  /** Ends listening and resolves with the final transcript. */
  stop(): Promise<string>;
}

export class PermissionDenied extends Error {
  constructor() {
    super('Microphone permission denied');
  }
}
