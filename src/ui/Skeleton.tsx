import { View } from 'react-native';
import { tokens } from './tokens';

export function Skeleton({ height = tokens.row, width }: { height?: number; width?: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{
        height,
        width,
        borderRadius: tokens.radius.control,
        backgroundColor: tokens.color.border,
      }}
    />
  );
}
