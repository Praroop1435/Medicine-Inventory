import { useSyncState } from '../hooks/useSyncState';

export function syncText({ online, pending }: { online: boolean; pending: number }): string {
  if (pending > 0)
    return online ? `syncing ${pending} changes` : `offline · ${pending} changes waiting`;
  return online ? 'synced' : 'offline';
}

export const useSyncText = (): string => syncText(useSyncState());
