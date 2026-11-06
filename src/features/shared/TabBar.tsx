import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Icon, ListRow, T, tokens, type IconName } from '@/ui';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'stock', label: 'Stock', icon: 'package' },
  { name: 'check', label: 'Check', icon: 'check' },
  { name: 'settings', label: 'Settings', icon: 'sliders' },
];

const ADD_ROWS: { label: string; icon: IconName; href: string }[] = [
  { label: 'Scan bill', icon: 'scan', href: '/intake/scan' },
  { label: 'Speak', icon: 'mic', href: '/intake/voice' },
  { label: 'Type', icon: 'keyboard', href: '/intake/manual' },
  { label: 'Bulk import', icon: 'file', href: '/intake/bulk' },
];

function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: tokens.color.scrim }}
      />
      <View
        style={{
          backgroundColor: tokens.color.surface,
          borderTopLeftRadius: tokens.radius.card,
          borderTopRightRadius: tokens.radius.card,
          paddingBottom: tokens.space[6],
        }}
      >
        {ADD_ROWS.map((r) => (
          <ListRow
            key={r.href}
            title={r.label}
            right={<Icon name={r.icon} />}
            onPress={() => {
              onClose();
              router.push(r.href);
            }}
          />
        ))}
      </View>
    </Modal>
  );
}

function Tab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? tokens.color.text : tokens.color.muted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ flex: 1, minHeight: tokens.touch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} color={color} />
      <T size={12} color={color} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** Home · Stock · Add · Check · Settings. Add is not a route: it opens the intake sheet. */
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const [adding, setAdding] = useState(false);
  const current = state.routes[state.index]?.name;
  const tab = (t: (typeof TABS)[number]) => {
    const route = state.routes.find((r) => r.name === t.name);
    return (
      <Tab
        key={t.name}
        label={t.label}
        icon={t.icon}
        active={current === t.name}
        onPress={() => route && navigateToTab(route.key)}
      />
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tokens.color.surface,
        borderTopWidth: 1,
        borderTopColor: tokens.color.border,
        paddingTop: tokens.space[1],
        paddingBottom: insets.bottom + tokens.space[1],
      }}
    >
      {TABS.slice(0, 2).map(tab)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={() => setAdding(true)}
          style={{
            width: tokens.fab,
            height: tokens.fab,
            borderRadius: tokens.fab / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.color.primary,
          }}
        >
          <Icon name="plus" color={tokens.color.onPrimary} />
        </Pressable>
      </View>
      {TABS.slice(2).map(tab)}
      <AddSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}
