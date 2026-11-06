import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { T, tokens } from '@/ui';

type Show = (message: string) => void;
const ToastContext = createContext<Show>(() => {});
const HIDE_AFTER_MS = 4000;

/** The app's one toast: a bottom bar message that hides itself after 4 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  // The object wrapper makes the same message shown twice restart the timer.
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const show = useCallback<Show>((message) => setToast({ message }), []);
  // Context, not the hook: tests render this without a SafeAreaProvider.
  const inset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View
          testID="toast"
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tokens.margin,
            right: tokens.margin,
            bottom: inset + tokens.toastOffset,
            padding: tokens.space[3],
            borderRadius: tokens.radius.control,
            backgroundColor: tokens.color.primary,
          }}
        >
          <T size={14} color={tokens.color.onPrimary}>
            {toast.message}
          </T>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  return useContext(ToastContext);
}

/** What a failed action toasts: never raw Firebase/JS text, only copy a shopkeeper can act on. */
export function errorCopy(e: unknown, fallback: string): string {
  const raw = `${(e as { code?: unknown } | null)?.code ?? ''} ${e instanceof Error ? e.message : ''}`;
  if (/not a member|permission-denied|insufficient permissions/i.test(raw))
    return 'This phone was removed from the shop.';
  if (/network|offline|unavailable|internet|timed? ?out/i.test(raw))
    return 'No internet. Your change is saved on this phone and will sync.';
  return fallback;
}
