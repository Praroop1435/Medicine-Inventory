import { Stack } from 'expo-router';
import { RepoProvider } from '@/data/RepoContext';
import type { Repos } from '@/data/repositories';
import { SessionProvider } from '@/features/onboarding/SessionContext';
import { InventoryProvider } from './hooks/useInventory';

/** Everything under the root layout once repos exist. Tests render this with memory repos. */
export function AppShell({ repos }: { repos: Repos }) {
  return (
    <RepoProvider repos={repos}>
      <SessionProvider>
        <InventoryProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </InventoryProvider>
      </SessionProvider>
    </RepoProvider>
  );
}
