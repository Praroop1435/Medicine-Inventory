import { Pressable, View } from 'react-native';
import { tokens } from './tokens';

/** The big round camera shutter: navy disc with a white ring, like a phone's camera app. */
export function ShutterButton({ label, onPress }: { label: string; onPress: () => void }) {
  const inner = tokens.shutter - tokens.space[3];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: tokens.shutter,
        height: tokens.shutter,
        borderRadius: tokens.shutter / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.color.navy,
        opacity: pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          borderWidth: tokens.stroke + 1,
          borderColor: tokens.color.onPrimary,
        }}
      />
    </Pressable>
  );
}
