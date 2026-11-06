import type { ReactNode } from 'react';
import { View } from 'react-native';
import { tokens } from './tokens';

export function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface,
        borderColor: tokens.color.border,
        borderWidth: 1,
        borderRadius: tokens.radius.card,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}
