import { Slot } from 'expo-router';

import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';
import TabLayoutScreen from '@/screens/routes/tabs/tab-layout-screen';

export default function TabLayoutWebScreen() {
  const isDesktopLayout = useIsDesktopWebLayout();

  if (!isDesktopLayout) {
    return <TabLayoutScreen />;
  }

  return (
    <WebProtectedShell>
      <Slot />
    </WebProtectedShell>
  );
}
