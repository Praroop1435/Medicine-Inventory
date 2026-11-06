import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { tokens } from './tokens';

export function ButtonRow({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
      {Children.map(children, (c) => (
        <View testID="button-row-cell" style={{ flex: 1 }}>
          {c}
        </View>
      ))}
    </View>
  );
}
