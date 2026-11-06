import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { T } from './Text';
import { tokens } from './tokens';

type Props = {
  title?: string;
  meta?: string;
  back?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Screen({ title, meta, back, onBack, children, footer }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.color.ground }}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Back, ${back}`}
          onPress={onBack ?? (() => router.back())}
          style={{
            height: tokens.touch,
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.space[1],
            paddingHorizontal: tokens.margin,
          }}
        >
          <Icon name="back" />
          <T size={14}>{back}</T>
        </Pressable>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: tokens.margin, paddingBottom: tokens.space[6] }}
        keyboardShouldPersistTaps="handled"
      >
        {title ? (
          <View style={{ paddingTop: tokens.space[2], paddingBottom: tokens.space[3] }}>
            <T size={24} weight="semibold" accessibilityRole="header">
              {title}
            </T>
            {meta ? (
              <T size={12} color={tokens.color.muted}>
                {meta}
              </T>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            backgroundColor: tokens.color.surface,
            borderTopWidth: 1,
            borderTopColor: tokens.color.border,
            padding: tokens.margin,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
