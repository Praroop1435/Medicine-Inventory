import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { Button, ErrorState, Field, Screen, tokens } from '@/ui';
import { resetTo } from '../resetTo';
import { parseQrPayload } from '../qr';
import { useSession } from '../SessionContext';

export function NameScreen() {
  const { qr } = useLocalSearchParams<{ qr?: string }>();
  const payload = qr ? parseQrPayload(qr) : null;
  const { shop } = useRepos();
  const { setSession } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const name = displayName.trim();
      const { deviceId } = await shop.joinShop(payload.shopId, payload.joinSecret, name);
      await setSession({ shopId: payload.shopId, deviceId, displayName: name });
      resetTo('/');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!payload)
    return (
      <Screen back="Back" title="Join shop">
        <ErrorState message="This isn't a shop QR code" />
      </Screen>
    );

  return (
    <Screen
      back="Back"
      title="Your name"
      meta="Shown in the shop history next to your changes"
      footer={<Button label="Join" full disabled={busy || !displayName.trim()} onPress={join} />}
    >
      <View style={{ gap: tokens.space[4] }}>
        <Field label="Your name" value={displayName} onChangeText={setDisplayName} />
        {error ? <ErrorState message={error} /> : null}
      </View>
    </Screen>
  );
}
