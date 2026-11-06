import { useState } from 'react';
import { View } from 'react-native';
import { useNotifier } from '@/features/shared/NotifierContext';
import { Button, IconTile, Screen, T, tokens } from '@/ui';
import { resetTo } from '../resetTo';

/** Last onboarding step on both paths (§11.6). Either answer goes on to the app. */
export function NotifyScreen() {
  const notifier = useNotifier();
  const [busy, setBusy] = useState(false);
  const allow = async () => {
    setBusy(true);
    await notifier.requestPermission().catch(() => false);
    resetTo('/');
  };
  return (
    <Screen title="Get expiry reminders">
      <View style={{ paddingBottom: tokens.space[3] }}>
        <IconTile icon="calendar" size={tokens.emptyIcon} round />
      </View>
      <T size={16}>
        Get a morning alert when medicines are expiring, and a night reminder to update stock.
      </T>
      <View style={{ gap: tokens.space[3], paddingTop: tokens.space[6] }}>
        <Button label="Allow notifications" full disabled={busy} onPress={allow} />
        <Button label="Not now" variant="secondary" full onPress={() => resetTo('/')} />
      </View>
    </Screen>
  );
}
