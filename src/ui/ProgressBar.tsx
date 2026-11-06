import { View } from 'react-native';
import { tokens } from './tokens';

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: tokens.color.border,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: `${pct}%`, height: 4, backgroundColor: tokens.color.primary }} />
    </View>
  );
}
