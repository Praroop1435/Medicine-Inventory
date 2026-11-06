import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /** Navy brand band at the top, drawn behind the status bar (Home, Welcome). */
  band?: ReactNode;
  /** Sits across the band's bottom edge, e.g. the Home search field. */
  bandEdge?: ReactNode;
  /** Centres short content in the space under the title; it still scrolls once it grows. */
  centered?: boolean;
};

/** The navy band behind a light status bar; the bar goes back to dark when the screen loses focus. */
function Band({ children, edge }: { children: ReactNode; edge?: ReactNode }) {
  const insets = useSafeAreaInsets();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
  return (
    <>
      <View
        testID="screen-band"
        style={{
          backgroundColor: tokens.color.navy,
          marginHorizontal: -tokens.margin,
          paddingHorizontal: tokens.margin,
          paddingTop: insets.top + tokens.space[4],
          paddingBottom: edge ? tokens.touch / 2 + tokens.space[4] : tokens.space[6],
        }}
      >
        {children}
      </View>
      {edge ? (
        <View style={{ marginTop: -tokens.touch / 2, marginBottom: tokens.space[3] }}>{edge}</View>
      ) : null}
    </>
  );
}

export function Screen({
  title,
  meta,
  back,
  onBack,
  children,
  footer,
  band,
  bandEdge,
  centered,
}: Props) {
  return (
    <SafeAreaView
      edges={band ? ['left', 'right', 'bottom'] : undefined}
      style={{ flex: 1, backgroundColor: tokens.color.ground }}
    >
      {/* Edge-to-edge Android doesn't resize for the keyboard; this shrinks the screen so the
          focused field and the docked footer stay above it. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
          contentContainerStyle={{
            flexGrow: centered ? 1 : undefined,
            paddingHorizontal: tokens.margin,
            paddingBottom: tokens.space[6],
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          {band ? <Band edge={bandEdge}>{band}</Band> : null}
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
          {centered ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>{children}</View>
          ) : (
            children
          )}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
