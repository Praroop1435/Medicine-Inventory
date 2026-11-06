import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRepos } from '@/data/RepoContext';
import type { CheckSession } from '@/data/repositories';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToday } from '@/features/shared/hooks/useToday';
import { Card, ListRow, Screen, Skeleton } from '@/ui';

const DAY = 86_400_000;

/** Check tab: categories checked least recently first, with any check in progress. */
export function CheckListScreen() {
  const { categories, medicines, batches, loading } = useInventory();
  const { check } = useRepos();
  const shopId = useSession().session?.shopId;
  const today = useToday();
  const [sessions, setSessions] = useState<Record<string, CheckSession | null>>({});
  const ids = categories.map((c) => c.id).join(',');

  useEffect(() => {
    if (!shopId || !ids) return;
    // shortcut: one listener per category; fine for the ~10 categories a shop has.
    const unsubs = ids
      .split(',')
      .map((id) => check.watchCheck(shopId, id, (s) => setSessions((m) => ({ ...m, [id]: s }))));
    return () => unsubs.forEach((u) => u());
  }, [check, shopId, ids]);

  const state = (id: string, lastCheckedAt: number | null) => {
    const s = sessions[id];
    if (s) {
      const live = batches.filter(
        (b) => medicines.find((m) => m.id === b.medicineId)?.categoryId === id,
      );
      return `partly checked · ${live.filter((b) => s.checked[b.id]).length} of ${live.length}`;
    }
    if (lastCheckedAt === null) return 'never checked';
    const days = Math.max(0, Math.floor((today.getTime() - lastCheckedAt) / DAY));
    return days === 0 ? 'checked today' : `checked ${days} day${days === 1 ? '' : 's'} ago`;
  };

  return (
    <Screen title="Check">
      {loading ? (
        <Skeleton />
      ) : (
        <Card>
          {[...categories]
            // null (never checked) sorts before any timestamp.
            .sort((a, b) => (a.lastCheckedAt ?? -1) - (b.lastCheckedAt ?? -1) || a.order - b.order)
            .map((c) => (
              <ListRow
                key={c.id}
                title={c.name}
                subtitle={state(c.id, c.lastCheckedAt)}
                chevron
                onPress={() => router.push(`/check/${c.id}`)}
              />
            ))}
        </Card>
      )}
    </Screen>
  );
}
