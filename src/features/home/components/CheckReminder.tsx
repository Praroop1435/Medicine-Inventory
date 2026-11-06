import { router } from 'expo-router';
import { childrenOf, descendantIds } from '@/domain/tree';
import type { Batch, Category, Medicine } from '@/domain/types';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToday } from '@/features/shared/hooks/useToday';
import { daysSince } from '@/lib/format';
import { Button, Card, SectionHeader, T, tokens } from '@/ui';
import { View } from 'react-native';

/**
 * The top-level folder to count next: only folders with live stock (sub-folders included),
 * never-checked first, then the oldest check. A top-level check covers its sub-folders.
 */
export function dueFolder(
  categories: Category[],
  medicines: Medicine[],
  batches: Batch[],
): Category | undefined {
  const folderOf = new Map(medicines.map((m) => [m.id, m.categoryId]));
  const stocked = new Set(batches.map((b) => folderOf.get(b.medicineId)));
  // `== null`: a folder never checked may come back without the field at all.
  const at = (c: Category) => (c.lastCheckedAt == null ? -Infinity : c.lastCheckedAt);
  return childrenOf(categories, null)
    .filter((c) => [c.id, ...descendantIds(categories, c.id)].some((id) => stocked.has(id)))
    .sort((a, b) => at(a) - at(b) || a.order - b.order)[0];
}

/** Nudges the least recently checked category; only once there is stock on the shelf to count. */
export function CheckReminder() {
  const { categories, medicines, batches, loading } = useInventory();
  const today = useToday();
  const c = loading ? undefined : dueFolder(categories, medicines, batches);
  if (!c) return null;
  const days = c.lastCheckedAt == null ? null : daysSince(c.lastCheckedAt, today);
  // The oldest check is from today, so every stocked folder is done.
  if (days === 0)
    return (
      <>
        <SectionHeader title="Stock check" />
        <Card>
          <View style={{ padding: tokens.space[4] }}>
            <T size={14} weight="medium">
              All stock checked today ✓
            </T>
          </View>
        </Card>
      </>
    );
  return (
    <>
      <SectionHeader title="Stock check" />
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.space[3],
            padding: tokens.space[4],
          }}
        >
          <View style={{ flex: 1 }}>
            <T size={14} weight="medium" numberOfLines={1}>{`${c.name} not checked`}</T>
            <T size={12} color={tokens.color.muted} numberOfLines={1}>
              {days === null
                ? 'Never checked'
                : `Last stock check ${days === 1 ? '1 day' : `${days} days`} ago`}
            </T>
          </View>
          <Button
            label="Start check"
            variant="secondary"
            onPress={() => router.push(`/check/${c.id}`)}
          />
        </View>
      </Card>
    </>
  );
}
