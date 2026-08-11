import { Stack } from 'expo-router';

import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';
import DigitalCardScreen from '@/screens/routes/digital-card/digital-card-screen';

export default function DigitalCardWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();

  return (
    <WebProtectedShell>
      {isDesktopLayout ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <DigitalCardScreen />
    </WebProtectedShell>
  );
}
