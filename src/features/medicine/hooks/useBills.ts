import { useEffect, useState } from 'react';
import { useRepos } from '@/data/RepoContext';
import type { Bill } from '@/domain/types';

/** Live bills by id; subscribes only to the ids given. */
export function useBills(shopId: string | undefined, ids: string[]): Map<string, Bill> {
  const { inventory } = useRepos();
  const [bills, setBills] = useState(new Map<string, Bill>());
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    if (!shopId || !key) return;
    const unsubs = key.split(',').map((id) =>
      inventory.watchBill(shopId, id, (b) =>
        setBills((m) => {
          const n = new Map(m);
          if (b) n.set(id, b);
          else n.delete(id);
          return n;
        }),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [inventory, shopId, key]);
  return bills;
}
