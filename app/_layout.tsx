import { useEffect, useState } from 'react';
import { createAppRepos } from '@/data/firebase';
import type { Repos } from '@/data/repositories';
import { AppShell } from '@/features/shared/AppShell';
import { ToastProvider, useToast } from '@/features/shared/Toast';
import { expoNotifier } from '@/services/notifications/expo';
import { ErrorState, Screen } from '@/ui';
import { useAppFonts } from '@/ui/fonts';

function Root() {
  const fontsReady = useAppFonts();
  const toast = useToast();
  const [repos, setRepos] = useState<Repos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    createAppRepos((e) => toast(`Couldn't save: ${e.message}`))
      .then((r) => live && setRepos(r))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [toast, attempt]);

  if (!fontsReady) return null;
  if (error && !repos)
    return (
      <Screen>
        <ErrorState
          message={`Couldn't start: ${error}`}
          onRetry={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        />
      </Screen>
    );
  if (!repos) return null;
  return <AppShell repos={repos} notifier={expoNotifier} />;
}

export default function RootLayout() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
