import { router } from 'expo-router';
import { View } from 'react-native';
import { ActionTile, Sheet, tokens, type IconName } from '@/ui';

const TILES: { label: string; subtitle: string; icon: IconName; href: string }[] = [
  { label: 'Scan bill', subtitle: 'Photo or PDF of a bill', icon: 'scan', href: '/intake/scan' },
  { label: 'Speak', subtitle: 'Say name, batch, expiry', icon: 'mic', href: '/intake/voice' },
  { label: 'Type', subtitle: 'One medicine at a time', icon: 'keyboard', href: '/intake/manual' },
  { label: 'Bulk import', subtitle: 'From a spreadsheet', icon: 'sheet', href: '/intake/bulk' },
];

/** The four ways to add stock, as a 2×2 grid. Mount it only while open. */
export function AddSheet({ onClose }: { onClose: () => void }) {
  const tile = (t: (typeof TILES)[number]) => (
    <ActionTile
      key={t.href}
      icon={t.icon}
      label={t.label}
      subtitle={t.subtitle}
      onPress={() => {
        onClose();
        router.push(t.href);
      }}
    />
  );
  return (
    <Sheet title="Add stock" onClose={onClose}>
      <View style={{ gap: tokens.space[3], paddingBottom: tokens.space[2] }}>
        {[TILES.slice(0, 2), TILES.slice(2)].map((pair) => (
          <View key={pair[0].href} style={{ flexDirection: 'row', gap: tokens.space[3] }}>
            {pair.map(tile)}
          </View>
        ))}
      </View>
    </Sheet>
  );
}
