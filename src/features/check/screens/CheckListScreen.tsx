import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { childrenOf, descendantIds } from '@/domain/tree';
import type { CheckSession } from '@/data/repositories';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToday } from '@/features/shared/hooks/useToday';
import { daysSince } from '@/lib/format';
import { AddSheet } from '@/features/shared/AddSheet';
import {
  Button,
  Card,
  EmptyState,
  ListRow,
  Pill,
  Screen,
  Skeleton,
  StatusPill,
  T,
  tokens,
} from '@/ui';

/** Check tab: top-level folders checked least recently first, with any check in progress. */
export function CheckListScreen() {
  const { categories, medicines, batches, loading } = useInventory();
  const { check } = useRepos();
  const shopId = useSession().session?.shopId;
  const today = useToday();
  const [sessions, setSessions] = useState<Record<string, CheckSession | null>>({});
  const [adding, setAdding] = useState(false);
  const top = childrenOf(categories, null);
  const ids = top.map((c) => c.id).join(',');

  useEffect(() => {
    if (!shopId || !ids) return;
    // shortcut: one listener per category; fine for the ~10 categories a shop has.
    const unsubs = ids
      .split(',')
      .map((id) => check.watchCheck(shopId, id, (s) => setSessions((m) => ({ ...m, [id]: s }))));
    return () => unsubs.forEach((u) => u());
  }, [check, shopId, ids]);

  const liveIn = (id: string) => {
    const scope = new Set([id, ...descendantIds(categories, id)]);
    return batches.filter((b) =>
      scope.has(medicines.find((m) => m.id === b.medicineId)?.categoryId ?? ''),
    );
  };
  const stocked = new Set(top.filter((c) => liveIn(c.id).length).map((c) => c.id));
  // Partly checked is in progress (teal); never checked wants attention (amber); an empty folder
  // has nothing to count, so it is quiet; the rest is quiet too.
  const state = (id: string, lastCheckedAt: number | null) => {
    const s = sessions[id];
    if (s) {
      const live = liveIn(id);
      const label = `Partly checked · ${live.filter((b) => s.checked[b.id]).length} of ${live.length}`;
      return { label, pill: <Pill tone="accent" label={label} /> };
    }
    if (!stocked.has(id))
      return { label: 'No stock', pill: <StatusPill status="ok" label="No stock" /> };
    if (lastCheckedAt === null)
      return { label: 'Never checked', pill: <StatusPill status="soon" label="Never checked" /> };
    const days = daysSince(lastCheckedAt, today);
    const label = days === 0 ? 'Checked today' : `Checked ${days} day${days === 1 ? '' : 's'} ago`;
    return { label, pill: <StatusPill status="ok" label={label} /> };
  };

  return (
    <Screen title="Check">
      {loading ? (
        <Skeleton />
      ) : batches.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="Nothing to check yet"
          body="Add stock first. Then count each shelf here, oldest checks first."
        >
          <Button label="Add stock" full onPress={() => setAdding(true)} />
        </EmptyState>
      ) : (
        <View style={{ gap: tokens.space[3] }}>
          <T size={14} color={tokens.color.muted}>
            Count what&apos;s on the shelf. Oldest checks first.
          </T>
          <Card>
            {top
              // Folders with stock first; null (never checked) sorts before any timestamp.
              .sort(
                (a, b) =>
                  Number(stocked.has(b.id)) - Number(stocked.has(a.id)) ||
                  (a.lastCheckedAt ?? -1) - (b.lastCheckedAt ?? -1) ||
                  a.order - b.order,
              )
              .map((c) => {
                const st = state(c.id, c.lastCheckedAt);
                return (
                  <ListRow
                    key={c.id}
                    icon="folder"
                    title={c.name}
                    accessibilityLabel={`${c.name}, ${st.label}`}
                    right={st.pill}
                    chevron
                    onPress={() => router.push(`/check/${c.id}`)}
                  />
                );
              })}
          </Card>
        </View>
      )}
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
