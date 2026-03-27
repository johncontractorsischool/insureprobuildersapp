import { useIsDesktopWebLayout, WebAuthShell } from '@/components/web-auth-shell';
import TabLayoutScreen from '@/screens/routes/tabs/tab-layout-screen';

export default function TabLayoutWebScreen() {
  const isDesktopLayout = useIsDesktopWebLayout();

  return (
    <WebAuthShell>
      <TabLayoutScreen hideTabBar={isDesktopLayout} />
    </WebAuthShell>
  );
}
