import * as Updates from 'expo-updates';
import type { Updater } from './Updater';

/** Pulls an OTA update from the build's channel and restarts into it. */
export const expoUpdater: Updater = {
  async check() {
    // Dev clients and Jest have updates off; there is nothing to check against.
    if (__DEV__ || !Updates.isEnabled) return 'unavailable';
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return 'latest';
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return 'latest';
  },
};
