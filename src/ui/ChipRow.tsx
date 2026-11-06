import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { tokens } from './tokens';

export function ChipRow({ children }: { children: ReactNode }) {
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
