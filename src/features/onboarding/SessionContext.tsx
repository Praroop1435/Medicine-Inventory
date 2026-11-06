import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Session = { shopId: string; deviceId: string; displayName: string };
type SessionValue = {
  session: Session | null;
  setSession(s: Session): Promise<void>;
  clear(): Promise<void>;
};

const KEY = 'session';
const SessionContext = createContext<SessionValue | null>(null);

/** Renders nothing until the stored session has been read, so screens never see a false "no session". */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, set] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    SecureStore.getItemAsync(KEY)
      .then((raw) => live && set(raw ? (JSON.parse(raw) as Session) : null))
      .catch(() => live && set(null));
    return () => {
      live = false;
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      session: session ?? null,
      async setSession(s) {
        await SecureStore.setItemAsync(KEY, JSON.stringify(s));
        set(s);
      },
      async clear() {
        await SecureStore.deleteItemAsync(KEY);
        set(null);
      },
    }),
    [session],
  );

  if (session === undefined) return null;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
