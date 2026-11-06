import type { Permission } from '../Permission';

export type ReminderId = 'morning' | 'night';

export interface Notifier extends Permission {
  /** Replaces any earlier reminder with the same id. `time` is "HH:MM", local. */
  scheduleDaily(
    id: ReminderId,
    time: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void>;
  cancel(id: ReminderId): Promise<void>;
  /** Calls back with a tapped reminder's data, including the tap that opened the app. */
  onTap(cb: (data: Record<string, string>) => void): () => void;
}

/** Does nothing; what tests and previews get unless they pass a notifier. */
export const silentNotifier: Notifier = {
  getPermission: async () => 'undetermined',
  requestPermission: async () => false,
  scheduleDaily: async () => {},
  cancel: async () => {},
  onTap: () => () => {},
};
