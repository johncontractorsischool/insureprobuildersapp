import { Stack } from 'expo-router';
import FormDetailWebScreen from '@/screens/routes/forms/form-detail-web-screen';
import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';

export default function FormDetailWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();

  return (
    <WebProtectedShell>
      {isDesktopLayout ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <FormDetailWebScreen />
    </WebProtectedShell>
  );
}
