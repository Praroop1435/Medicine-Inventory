import { syncText } from '../components/SyncLine';

describe('syncText', () => {
  it.each([
    [{ online: true, pending: 0 }, 'synced'],
    [{ online: false, pending: 0 }, 'offline'],
    [{ online: false, pending: 3 }, 'offline · 3 changes waiting'],
    [{ online: true, pending: 2 }, 'syncing 2 changes'],
  ])('%j -> %s', (s, text) => expect(syncText(s)).toBe(text));
});
