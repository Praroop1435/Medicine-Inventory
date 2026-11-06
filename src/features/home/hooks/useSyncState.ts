import { useEffect, useState } from 'react';
import { useRepos } from '@/data/RepoContext';
import type { SyncState } from '@/data/repositories';
import { useSession } from '@/features/onboarding/SessionContext';

export function useSyncState(): SyncState {
  const { inventory } = useRepos();
  const shopId = useSession().session?.shopId;
  const [state, setState] = useState<SyncState>({ online: true, pending: 0 });
  useEffect(
    () => (shopId ? inventory.watchSyncState(shopId, setState) : undefined),
    [inventory, shopId],
  );
  return state;
}
