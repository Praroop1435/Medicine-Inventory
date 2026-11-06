import { useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { Button, ErrorState, Field, Screen, tokens } from '@/ui';
import { resetTo } from '../resetTo';
import { useSession } from '../SessionContext';

export function SetupScreen() {
  const { shop } = useRepos();
  const { setSession } = useSession();
  const [shopName, setShopName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const name = displayName.trim();
      const { shopId, deviceId } = await shop.createShop(shopName.trim(), name);
      await setSession({ shopId, deviceId, displayName: name });
      resetTo('/onboarding/qr');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen
      back="Back"
      title="Set up shop"
      footer={
        <Button
          label="Create shop"
          full
          disabled={busy || !shopName.trim() || !displayName.trim()}
          onPress={create}
        />
      }
    >
      <View style={{ gap: tokens.space[4] }}>
        <Field
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          hint="e.g. Anand Medical"
        />
        <Field
          label="Your name"
          value={displayName}
          onChangeText={setDisplayName}
          hint="Shown next to your changes"
        />
        {error ? <ErrorState message={error} /> : null}
      </View>
    </Screen>
  );
}
