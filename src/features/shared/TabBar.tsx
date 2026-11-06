import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, T, tokens, type IconName } from '@/ui';
import { AddSheet } from './AddSheet';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'stock', label: 'Stock', icon: 'package' },
  { name: 'check', label: 'Check', icon: 'check' },
  { name: 'settings', label: 'Settings', icon: 'sliders' },
];

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
  const color = active ? tokens.color.navy : tokens.color.muted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center' }}
    >
      <View
        testID={active ? 'tab-indicator' : undefined}
        style={{
          width: tokens.touch,
          height: tokens.indicator,
          borderBottomLeftRadius: tokens.indicator,
          borderBottomRightRadius: tokens.indicator,
          backgroundColor: active ? tokens.color.teal : undefined,
        }}
      />
      <View
        style={{
          flex: 1,
          minHeight: tokens.touch,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} color={color} />
        <T size={12} weight={active ? 'semibold' : 'regular'} color={color} numberOfLines={1}>
          {label}
        </T>
      </View>
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
        backgroundColor: tokens.color.surface,
        borderTopWidth: 1,
        borderTopColor: tokens.color.border,
        paddingBottom: insets.bottom + tokens.space[1],
      }}
    >
      {TABS.slice(0, 2).map(tab)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        onPress={() => setAdding(true)}
        style={{ flex: 1, alignItems: 'center', paddingTop: tokens.space[1] }}
      >
        <View
          style={{
            width: tokens.fab,
            height: tokens.fab,
            borderRadius: tokens.fab / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.color.navy,
          }}
        >
          <Icon name="plus" size={tokens.fab / 2} color={tokens.color.onPrimary} />
        </View>
        <T size={12} weight="semibold" color={tokens.color.navy}>
          Add
        </T>
      </Pressable>
      {TABS.slice(2).map(tab)}
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </View>
  );
}
