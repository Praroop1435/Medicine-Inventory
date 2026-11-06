import type { Repos } from '../repositories';
import { ensureSignedIn } from './auth';
import { createFirebaseRepos } from './createFirebaseRepos';

// The only entry the app imports Firebase through (root layout). Never import this from features or tests.
export async function createAppRepos(onWriteError: (e: Error) => void): Promise<Repos> {
  await ensureSignedIn();
  return createFirebaseRepos({ onWriteError });
}
