import { useIsDesktopWebLayout } from '@/components/web-auth-shell';
import ProfileScreen from '@/screens/routes/tabs/profile-screen';

export default function ProfileWebRoute() {
  const isDesktopLayout = useIsDesktopWebLayout();
  return <ProfileScreen includeTabBarPadding={!isDesktopLayout} isDesktopLayout={isDesktopLayout} />;
}
