import { Stack } from 'expo-router';

import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';
import PaymentScreen from '@/screens/routes/payment/payment-screen';

export default function PaymentWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();

  return (
    <WebProtectedShell>
      {isDesktopLayout ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <PaymentScreen showInContentBackButton={isDesktopLayout} isDesktopLayout={isDesktopLayout} />
    </WebProtectedShell>
  );
}
