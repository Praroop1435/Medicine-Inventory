import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRepos } from '@/data/RepoContext';
import {
  applyMatch,
  canSave,
  confirmField,
  type DraftBatch,
  type DraftField,
} from '@/domain/draft';
import type { Company, Medicine } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';

export type BillHeader = { supplier: string; billNo: string; billDate: string };
export type DraftPatch = Partial<Pick<DraftBatch, DraftField>>;

type Intake = {
  drafts: DraftBatch[];
  bill: BillHeader | null;
  setDrafts(ds: DraftBatch[], bill?: BillHeader | null): void;
  update(key: string, patch: DraftPatch): void;
  confirm(key: string, field: DraftField): void;
  remove(key: string): void;
  /** Saves every draft in one write and clears them; rejects (keeping them) on failure. */
  save(): Promise<void>;
};

// A matched row takes these from the existing medicine, so doubts about them don't apply.
const FROM_MATCH: DraftField[] = ['companyName', 'categoryId', 'unit'];
const tidy = (d: DraftBatch): DraftBatch =>
  d.matchedMedicineId ? { ...d, uncertain: d.uncertain.filter((f) => !FROM_MATCH.includes(f)) } : d;

/**
 * Applies a user edit. A field whose value actually changes stops being uncertain; any
 * name edit re-runs matching, and losing a match clears the category and unit it filled
 * and marks the inherited company uncertain.
 */
export function editDraft(
  d: DraftBatch,
  patch: DraftPatch,
  medicines: Medicine[],
  companies: Company[],
): DraftBatch {
  const changed = (Object.keys(patch) as DraftField[]).filter(
    (f) => JSON.stringify(patch[f]) !== JSON.stringify(d[f]),
  );
  let next: DraftBatch = {
    ...d,
    ...patch,
    uncertain: d.uncertain.filter((f) => !changed.includes(f)),
  };
  if ('medicineName' in patch) {
    const m = applyMatch(next, medicines, companies);
    next =
      m.matchedMedicineId || !d.matchedMedicineId
        ? m
        : {
            ...m,
            categoryId: null,
            unit: null,
            // The company came from the lost match: keep it, but make a human confirm it.
            uncertain: [...m.uncertain.filter((f) => f !== 'companyName'), 'companyName'],
          };
  }
  return tidy(next);
}

/** The one save path for every intake: refuses anything a human hasn't confirmed. */
export function useSaveDrafts() {
  const { inventory } = useRepos();
  const session = useSession().session;
  return (drafts: DraftBatch[], bill: BillHeader | null): Promise<void> => {
    if (!session) return Promise.reject(new Error('No shop on this phone'));
    if (!canSave(drafts)) return Promise.reject(new Error('Some fields still need a look'));
    return inventory.saveIntake(
      session.shopId,
      drafts,
      bill && { ...bill, scannedBy: session.displayName },
      session.deviceId,
    );
  };
}

const IntakeContext = createContext<Intake | null>(null);

/** Holds the drafts between an adapter (scan, voice, bulk) and the review screen. */
export function IntakeProvider({ children }: { children: ReactNode }) {
  const { medicines, companies } = useInventory();
  const saveDrafts = useSaveDrafts();
  const [state, setState] = useState<{ drafts: DraftBatch[]; bill: BillHeader | null }>({
    drafts: [],
    bill: null,
  });
  const map = (key: string, f: (d: DraftBatch) => DraftBatch) =>
    setState((s) => ({ ...s, drafts: s.drafts.map((d) => (d.key === key ? f(d) : d)) }));

  const value: Intake = {
    ...state,
    // Adapters needn't match: applyMatch is idempotent, so pre-matched drafts are unchanged.
    setDrafts: (ds, bill = null) =>
      setState({ drafts: ds.map((d) => tidy(applyMatch(d, medicines, companies))), bill }),
    update: (key, patch) => map(key, (d) => editDraft(d, patch, medicines, companies)),
    confirm: (key, field) => map(key, (d) => confirmField(d, field)),
    remove: (key) => setState((s) => ({ ...s, drafts: s.drafts.filter((d) => d.key !== key) })),
    async save() {
      await saveDrafts(state.drafts, state.bill);
      setState({ drafts: [], bill: null });
    },
  };
  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake(): Intake {
  const v = useContext(IntakeContext);
  if (!v) throw new Error('useIntake must be used inside IntakeProvider');
  return v;
}
