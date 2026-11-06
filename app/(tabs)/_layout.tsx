import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSession } from '@/features/onboarding/SessionContext';
import { TabBar } from '@/features/shared/TabBar';

export default function TabsLayout() {
  const { session } = useSession();
  // A saved session goes straight here; joinShop is never called again for it.
  if (!session) return <Redirect href="/onboarding" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stock" />
      <Tabs.Screen name="check" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
