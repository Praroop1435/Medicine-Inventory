import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Logo, Screen, T, tokens } from '@/ui';

export function WelcomeScreen() {
  return (
    <Screen
      band={
        <View style={{ alignItems: 'center', paddingVertical: tokens.space[6] }}>
          <Logo size={tokens.logo.hero} />
        </View>
      }
      footer={
        <View style={{ gap: tokens.space[3] }}>
          <Button label="Set up shop" full onPress={() => router.push('/onboarding/setup')} />
          <Button
            label="Join shop"
            variant="secondary"
            full
            onPress={() => router.push('/onboarding/join')}
          />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: tokens.space[2], paddingTop: tokens.space[6] }}>
        <T size={24} weight="semibold" accessibilityRole="header">
          Med Stock
        </T>
        <T size={16} color={tokens.color.muted} style={{ textAlign: 'center' }}>
          Expiry alerts and stock for your medical shop.
        </T>
        <T size={14} color={tokens.color.muted} style={{ textAlign: 'center' }}>
          Set up a new shop on this phone, or join one another phone already set up.
        </T>
      </View>
    </Screen>
  );
}
