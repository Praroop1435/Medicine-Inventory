import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tokens.margin,
            right: tokens.margin,
            bottom: tokens.row + tokens.margin,
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
