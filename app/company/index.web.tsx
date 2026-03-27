import { Stack } from 'expo-router';
import CompanyDetailScreen from '@/screens/routes/company/company-detail-screen';
import { useIsDesktopWebLayout, WebProtectedShell } from '@/components/web-auth-shell';

export default function CompanyDetailWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();

  return (
    <WebProtectedShell>
      {isDesktopLayout ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <CompanyDetailScreen showInContentBackButton={isDesktopLayout} />
    </WebProtectedShell>
  );
}
