import { Stack } from 'expo-router';
import FormsIndexScreen from '@/screens/routes/forms/forms-index-screen';
import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';

export default function FormsIndexWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();

  return (
    <WebProtectedShell>
      {isDesktopLayout ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <FormsIndexScreen showInContentBackButton={isDesktopLayout} />
    </WebProtectedShell>
  );
}
