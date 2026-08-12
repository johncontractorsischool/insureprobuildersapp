import { Redirect, Stack } from 'expo-router';

import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';
import { DIGITAL_BUSINESS_CARD_ENABLED } from '@/constants/feature-flags';
import DigitalCardScreen from '@/screens/routes/digital-card/digital-card-screen';

export default function DigitalCardWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();

  if (!DIGITAL_BUSINESS_CARD_ENABLED) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <WebProtectedShell>
      {isDesktopLayout ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <DigitalCardScreen />
    </WebProtectedShell>
  );
}
