import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { tokens } from './tokens';

/** Big round tap-to-talk button; a teal ring pulses around it while listening. */
export function MicButton({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!listening) return pulse.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);
  const ring = tokens.mic + tokens.space[6];
  return (
    <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
      {listening ? (
        <Animated.View
          testID="mic-pulse"
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            backgroundColor: tokens.color.teal,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            ],
          }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
        accessibilityState={{ selected: listening }}
        onPress={onPress}
        style={({ pressed }) => ({
          width: tokens.mic,
          height: tokens.mic,
          borderRadius: tokens.mic / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: listening ? tokens.color.teal : tokens.color.navy,
          opacity: pressed ? tokens.opacity.pressed : 1,
        })}
      >
        <Icon name="mic" size={tokens.mic / 3} color={tokens.color.onPrimary} />
      </Pressable>
    </View>
  );
}
