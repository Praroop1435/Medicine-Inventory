import { useEffect, useState } from 'react';
import { useRepos } from '@/data/RepoContext';
import type { Shop } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';

export function useShop(): Shop | null {
  const { shop } = useRepos();
  const shopId = useSession().session?.shopId;
  const [value, setValue] = useState<Shop | null>(null);
  useEffect(() => {
    if (!shopId) return;
    const unsub = shop.watchShop(shopId, setValue);
    return () => {
      unsub();
      setValue(null);
    };
  }, [shop, shopId]);
  return value;
}
