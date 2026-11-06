export interface Updater {
  /** Applies and reloads when an update is found; otherwise says why nothing happened. */
  check(): Promise<'latest' | 'unavailable'>;
}

// shortcut: expo-updates isn't installed yet, so every build says "unavailable"; Task 18 adds the real one.
export const noUpdater: Updater = { check: async () => 'unavailable' };
