import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { shopNightTime, type Device, type Shop } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useShop } from '@/features/shared/hooks/useShop';
import { useNotifier } from '@/features/shared/NotifierContext';
import { usePermissionStatus } from '@/features/shared/PermissionGate';
import { errorCopy, useToast } from '@/features/shared/Toast';
import { expoUpdater } from '@/services/updates/expo';
import type { Updater } from '@/services/updates/Updater';
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  ErrorState,
  Field,
  KeyValueRow,
  ListRow,
  Screen,
  SectionHeader,
  tokens,
} from '@/ui';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = /^[1-9]\d{0,3}$/;

/** Returns the first problem, or null when the reminder settings can be saved. */
function reminderError(first: string, second: string, morning: string, night: string) {
  if (!DAYS.test(first) || !DAYS.test(second)) return 'Warning days must be whole numbers above 0';
  if (Number(second) >= Number(first)) return 'Second alert must be fewer days than first';
  if (!TIME.test(morning) || !TIME.test(night)) return 'Times must be HH:MM, from 00:00 to 23:59';
  return null;
}

function Reminders({ shop }: { shop: Shop }) {
  const { shop: shopRepo } = useRepos();
  const { session } = useSession();
  const toast = useToast();
  const [first, setFirst] = useState(String(shop.alertDays.first));
  const [second, setSecond] = useState(String(shop.alertDays.second));
  const [morning, setMorning] = useState(shop.notifyTime);
  const [night, setNight] = useState(shopNightTime(shop));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const e = reminderError(first.trim(), second.trim(), morning.trim(), night.trim());
    setError(e);
    if (e || !session) return;
    try {
      await shopRepo.updateShop(
        shop.id,
        {
          alertDays: { first: Number(first), second: Number(second) },
          notifyTime: morning.trim(),
          nightTime: night.trim(),
        },
        session.deviceId,
      );
      toast('Reminders saved');
    } catch (err) {
      toast(errorCopy(err, "Couldn't save. Check the connection and try again."));
    }
  };

  return (
    <View style={{ gap: tokens.space[3] }}>
      <Field
        label="First warning (days)"
        value={first}
        onChangeText={setFirst}
        keyboardType="number-pad"
      />
      <Field
        label="Second warning (days)"
        value={second}
        onChangeText={setSecond}
        keyboardType="number-pad"
      />
      <Field label="Morning alert time" value={morning} onChangeText={setMorning} />
      <Field label="Night reminder time" value={night} onChangeText={setNight} />
      {error ? <ErrorState message={error} /> : null}
      <Button label="Save reminders" full onPress={save} />
    </View>
  );
}

/** Settings has exactly four parts (§11.3): Reminders, Phones, This phone's name, App. */
export function SettingsScreen({ updater = expoUpdater }: { updater?: Updater }) {
  const { shop: shopRepo } = useRepos();
  const { session, setSession } = useSession();
  const shop = useShop();
  const notifier = useNotifier();
  const notifications = usePermissionStatus(notifier);
  const toast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [removing, setRemoving] = useState<Device | null>(null);
  const [rotating, setRotating] = useState(false);
  // A removed phone may be lost with the QR on it: by default its join code dies with it.
  const [newCode, setNewCode] = useState(true);
  const [name, setName] = useState(session?.displayName ?? '');
  const shopId = session?.shopId;
  const me = session?.deviceId;

  useEffect(
    () => (shopId ? shopRepo.watchDevices(shopId, setDevices) : undefined),
    [shopRepo, shopId],
  );

  const fail = (e: unknown) =>
    toast(errorCopy(e, "Couldn't save. Check the connection and try again."));
  const turnOn = async () => {
    if (await notifier.requestPermission().catch(() => false)) notifications.setStatus('granted');
    else void Linking.openSettings();
  };
  const rotate = async () => {
    setRotating(false);
    if (!shopId || !me) return;
    try {
      await shopRepo.rotateJoinSecret(shopId, me);
      router.push('/settings/qr');
    } catch (e) {
      fail(e);
    }
  };
  const remove = async (d: Device) => {
    setRemoving(null);
    if (!shopId || !me) return;
    try {
      await shopRepo.removeDevice(shopId, d.id, me);
    } catch (e) {
      return fail(e);
    }
    if (newCode) await rotate();
  };
  const saveName = async () => {
    const n = name.trim();
    if (!n || !session) return;
    try {
      await shopRepo.renameDevice(session.shopId, session.deviceId, n);
      await setSession({ ...session, displayName: n });
      setName(n);
      toast('Name saved');
    } catch (e) {
      fail(e);
    }
  };
  const checkUpdate = async () => {
    const r = await updater.check().catch(() => 'failed' as const);
    toast(
      r === 'latest'
        ? 'You have the latest version'
        : r === 'unavailable'
          ? "This build doesn't get updates"
          : "Couldn't check for updates",
    );
  };

  return (
    <Screen title="Settings">
      <SectionHeader title="Reminders" />
      {notifications.status && notifications.status !== 'granted' ? (
        <Card>
          <ListRow
            title="Notifications are off"
            right={<Button label="Turn on" variant="secondary" onPress={turnOn} />}
          />
        </Card>
      ) : null}
      {shop ? (
        <View style={{ paddingTop: tokens.space[3] }}>
          <Reminders key={shop.id} shop={shop} />
        </View>
      ) : null}

      <SectionHeader title="Phones" />
      <Card>
        {devices
          .filter((d) => !d.removed)
          .map((d) =>
            d.id === me ? (
              <ListRow key={d.id} title={`${d.displayName} (this phone)`} />
            ) : (
              <ListRow
                key={d.id}
                title={d.displayName}
                right={
                  <Button
                    label="Remove"
                    variant="secondary"
                    onPress={() => {
                      setNewCode(true);
                      setRemoving(d);
                    }}
                  />
                }
              />
            ),
          )}
        <ListRow title="Show join QR" chevron onPress={() => router.push('/settings/qr')} />
        <ListRow title="New join code" onPress={() => setRotating(true)} />
      </Card>

      <SectionHeader title="This phone's name" />
      <View style={{ gap: tokens.space[3] }}>
        <Field label="Phone name" value={name} onChangeText={setName} />
        <Button label="Save name" full disabled={!name.trim()} onPress={saveName} />
      </View>

      <SectionHeader title="App" />
      <KeyValueRow label="Version" value={Constants.expoConfig?.version ?? '—'} />
      <Button label="Check for update" variant="secondary" full onPress={checkUpdate} />

      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.displayName}?`}
          message="It loses access to the shop."
          confirmLabel="Remove"
          destructive
          onConfirm={() => void remove(removing)}
          onCancel={() => setRemoving(null)}
        >
          <Checkbox label="Also make a new join code" checked={newCode} onChange={setNewCode} />
        </ConfirmDialog>
      ) : null}
      {rotating ? (
        <ConfirmDialog
          title="Make a new join code?"
          message="Saved QR images stop working. Phones already in the shop keep working."
          confirmLabel="New code"
          destructive
          onConfirm={rotate}
          onCancel={() => setRotating(false)}
        />
      ) : null}
    </Screen>
  );
}
