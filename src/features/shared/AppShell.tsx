import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { RepoProvider, useRepos } from '@/data/RepoContext';
import type { Repos } from '@/data/repositories';
import { IntakeProvider } from '@/features/intake/IntakeContext';
import { SessionProvider, useSession } from '@/features/onboarding/SessionContext';
import type { Notifier } from '@/services/notifications/Notifier';
import { silentNotifier } from '@/services/notifications/Notifier';
import { InventoryProvider } from './hooks/useInventory';
import { NotifierProvider } from './NotifierContext';
import { useToast } from './Toast';

/** A phone removed on another phone says so once, forgets the shop and starts over. */
function RemovedGuard() {
  const { shop } = useRepos();
  const { session, clear } = useSession();
  const toast = useToast();
  const shopId = session?.shopId;
  const deviceId = session?.deviceId;
  useEffect(
    () =>
      shopId && deviceId
        ? shop.watchMembership(shopId, deviceId, () => {
            toast('This phone was removed from the shop.');
            void clear().then(() => router.replace('/onboarding'));
          })
        : undefined,
    [shop, shopId, deviceId, clear, toast],
  );
  return null;
}

/** Everything under the root layout once repos exist. Tests render this with memory repos. */
export function AppShell({
  repos,
  notifier = silentNotifier,
}: {
  repos: Repos;
  notifier?: Notifier;
}) {
  return (
    <NotifierProvider value={notifier}>
      <RepoProvider repos={repos}>
        <SessionProvider>
          <RemovedGuard />
          <InventoryProvider>
            <IntakeProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </IntakeProvider>
          </InventoryProvider>
        </SessionProvider>
      </RepoProvider>
    </NotifierProvider>
  );
}
