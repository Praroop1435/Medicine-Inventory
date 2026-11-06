import { Stack } from 'expo-router';
import { RepoProvider } from '@/data/RepoContext';
import type { Repos } from '@/data/repositories';
import { IntakeProvider } from '@/features/intake/IntakeContext';
import { SessionProvider } from '@/features/onboarding/SessionContext';
import type { Notifier } from '@/services/notifications/Notifier';
import { silentNotifier } from '@/services/notifications/Notifier';
import { InventoryProvider } from './hooks/useInventory';
import { NotifierProvider } from './NotifierContext';

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
