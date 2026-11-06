import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  useFonts,
} from '@expo-google-fonts/geist';

/** Call once in the root layout; returns true when Geist is ready (or failed, so the app still renders). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  return loaded || error !== null;
}
