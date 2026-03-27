import { Stack } from 'expo-router';
import PolicyDetailScreen from '@/screens/routes/policy/policy-detail-screen';
import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';

export default function PolicyDetailWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();

  return (
    <WebProtectedShell>
      {isDesktopLayout ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <PolicyDetailScreen showInContentBackButton={isDesktopLayout} />
    </WebProtectedShell>
  );
}
