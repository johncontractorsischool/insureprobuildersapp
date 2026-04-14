import { useIsDesktopWebLayout } from '@/components/web-auth-shell';
import PoliciesScreen from '@/screens/routes/tabs/policies-screen';

export default function PoliciesWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();
  return <PoliciesScreen includeTabBarPadding={!isDesktopLayout} isDesktopLayout={isDesktopLayout} />;
}
