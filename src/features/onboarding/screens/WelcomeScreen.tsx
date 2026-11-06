import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Screen, T, tokens } from '@/ui';

export function WelcomeScreen() {
  return (
    <Screen title="Medicine stock">
      <T size={14} color={tokens.color.muted}>
        Set up a new shop on this phone, or join a shop another phone already set up.
      </T>
      <View style={{ gap: tokens.space[3], paddingTop: tokens.space[6] }}>
        <Button label="Set up shop" full onPress={() => router.push('/onboarding/setup')} />
        <Button
          label="Join shop"
          variant="secondary"
          full
          onPress={() => router.push('/onboarding/join')}
        />
      </View>
    </Screen>
  );
}
