import { router } from 'expo-router';
import { childrenOf, descendantIds } from '@/domain/tree';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToday } from '@/features/shared/hooks/useToday';
import { Button, Card, SectionHeader, T, tokens } from '@/ui';
import { View } from 'react-native';

const DAY = 86_400_000;

/** Nudges the least recently checked category; only once there is stock on the shelf to count. */
export function CheckReminder() {
  const { categories, medicines, batches, loading } = useInventory();
  const today = useToday();
  // Only folders with something on the shelf to count (their sub-folders included).
  const stocked = new Set(
    batches.map((b) => medicines.find((m) => m.id === b.medicineId)?.categoryId),
  );
  const top = childrenOf(categories, null).filter((c) =>
    [c.id, ...descendantIds(categories, c.id)].some((id) => stocked.has(id)),
  );
  if (loading || top.length === 0) return null;
  // null (never checked) sorts before any timestamp. A top-level check covers its sub-folders.
  const c = top.sort(
    (a, b) => (a.lastCheckedAt ?? -1) - (b.lastCheckedAt ?? -1) || a.order - b.order,
  )[0];
  const days =
    c.lastCheckedAt === null
      ? null
      : Math.max(0, Math.floor((today.getTime() - c.lastCheckedAt) / DAY));
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
