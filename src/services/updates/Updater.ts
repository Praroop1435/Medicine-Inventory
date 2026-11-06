export interface Updater {
  /** Applies and reloads when an update is found; otherwise says why nothing happened. */
  check(): Promise<'latest' | 'unavailable'>;
}
