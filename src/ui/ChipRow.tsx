import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { tokens } from './tokens';

/** Chips in one sideways-scrolling line; `wrap` puts every option on screen instead (pickers). */
export function ChipRow({ children, wrap }: { children: ReactNode; wrap?: boolean }) {
  if (wrap)
    return (
      <View
        testID="chip-wrap"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] }}
      >
        {children}
      </View>
    );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: tokens.space[2], paddingHorizontal: tokens.margin }}
      style={{ flexGrow: 0, marginHorizontal: -tokens.margin }}
    >
      {children}
    </ScrollView>
  );
}
