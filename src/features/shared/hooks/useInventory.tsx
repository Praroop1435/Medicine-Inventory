import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRepos } from '@/data/RepoContext';
import type { Batch, Category, Company, Medicine } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';

export type Inventory = {
  categories: Category[];
  companies: Company[];
  medicines: Medicine[];
  batches: Batch[];
  loading: boolean;
};

const EMPTY: Inventory = {
  categories: [],
  companies: [],
  medicines: [],
  batches: [],
  loading: true,
};
const InventoryContext = createContext<Inventory>(EMPTY);

/** Holds the app's single listener per collection; every useInventory() reads from here. */
export function InventoryProvider({ children }: { children: ReactNode }) {
  const { inventory } = useRepos();
  const shopId = useSession().session?.shopId;
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!shopId) return;
    const seen = new Set<keyof Inventory>();
    const on =
      <K extends Exclude<keyof Inventory, 'loading'>>(key: K) =>
      (value: Inventory[K]) => {
        seen.add(key);
        setState((s) => ({ ...s, [key]: value, loading: seen.size < 4 }));
      };
    const unsubs = [
      inventory.watchCategories(shopId, on('categories')),
      inventory.watchCompanies(shopId, on('companies')),
      inventory.watchMedicines(shopId, on('medicines')),
      inventory.watchLiveBatches(shopId, on('batches')),
    ];
    return () => {
      unsubs.forEach((u) => u());
      setState(EMPTY);
    };
  }, [inventory, shopId]);

  return <InventoryContext.Provider value={state}>{children}</InventoryContext.Provider>;
}

/** State object and arrays keep their identity until a listener delivers new data. */
export function useInventory(): Inventory {
  return useContext(InventoryContext);
}
