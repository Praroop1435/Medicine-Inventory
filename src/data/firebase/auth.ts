import { getAuth, signInAnonymously } from '@react-native-firebase/auth';

// The anonymous uid is this phone's device id; the native SDK keeps it across launches.
export async function ensureSignedIn(): Promise<string> {
  const auth = getAuth();
  return auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid;
}
