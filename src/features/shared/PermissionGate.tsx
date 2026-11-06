import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import type { Permission, PermissionStatus } from '@/services/Permission';
import { Button, T, tokens } from '@/ui';

/** Current OS status; re-read when the app comes back from the background (e.g. from Android settings). */
export function usePermissionStatus(source: Permission) {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const refresh = useCallback(
    () => source.getPermission().then(setStatus, () => setStatus('undetermined')),
    [source],
  );
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);
  return { status, setStatus };
}

export type PermissionGate = {
  /** ask = show the one-line reason first (§11.6); off = refused, point to Android settings. */
  state: 'loading' | 'granted' | 'ask' | 'off';
  /** Asks the OS; when 'off' and the OS still says no, opens Android settings. */
  allow(): Promise<void>;
};

/** The reason is shown once per permission, before the first system prompt. */
export function usePermissionGate(kind: 'camera' | 'mic', source: Permission): PermissionGate {
  const key = `permission-seen-${kind}`;
  const { status, setStatus } = usePermissionStatus(source);
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(key).then(
      (v) => setSeen(!!v),
      () => setSeen(false),
    );
  }, [key]);

  const state =
    status === null || seen === null
      ? 'loading'
      : status === 'granted'
        ? 'granted'
        : seen
          ? 'off'
          : 'ask';
  // From 'off', ask the OS again first: Android may still show its prompt. Settings only if it won't.
  const allow = async () => {
    const off = state === 'off';
    setSeen(true);
    await SecureStore.setItemAsync(key, '1').catch(() => {});
    const ok = await source.requestPermission().catch(() => false);
    setStatus(ok ? 'granted' : 'denied');
    if (!ok && off) void Linking.openSettings();
  };
  return { state, allow };
}

/** Renders nothing unless the gate needs the reason or the "Open settings" fallback. */
export function PermissionPrompt({
  gate,
  reason,
  off,
}: {
  gate: PermissionGate;
  reason: string;
  off: string;
}) {
  if (gate.state !== 'ask' && gate.state !== 'off') return null;
  const ask = gate.state === 'ask';
  return (
    <View style={{ gap: tokens.space[3] }}>
      <T size={14} color={tokens.color.muted}>
        {ask ? reason : off}
      </T>
      <Button label={ask ? 'Continue' : 'Open settings'} onPress={gate.allow} />
    </View>
  );
}
