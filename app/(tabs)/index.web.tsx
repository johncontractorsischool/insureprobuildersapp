import { useIsDesktopWebLayout } from '@/components/web-auth-shell';
import DashboardScreen from '@/screens/routes/tabs/dashboard-screen';

export default function DashboardWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();
  return (
    <DashboardScreen
      isDesktopLayout={isDesktopLayout}
      includeTabBarPadding={!isDesktopLayout}
      showHeaderBrandMark={!isDesktopLayout}
    />
  );
}
