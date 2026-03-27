import { PropsWithChildren, useMemo } from 'react';
import { Href, Redirect, router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer, ScreenContainerSettingsProvider } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

type NavKey = 'dashboard' | 'policies' | 'account';

type NavItem = {
  key: NavKey;
  label: string;
  href: Href;
};

const DESKTOP_MAX_CONTENT_WIDTH = 1080;
export const WEB_DESKTOP_LAYOUT_MIN_WIDTH = 960;

export function useIsDesktopWebLayout() {
  const { width } = useWindowDimensions();
  return width >= WEB_DESKTOP_LAYOUT_MIN_WIDTH;
}

const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/(tabs)' },
  { key: 'policies', label: 'Policies', href: '/(tabs)/policies' },
  { key: 'account', label: 'Account', href: '/(tabs)/profile' },
] as const;

function toActiveNavKey(pathname: string): NavKey {
  if (pathname === '/' || pathname === '/(tabs)') {
    return 'dashboard';
  }

  if (
    pathname.startsWith('/policies') ||
    pathname.startsWith('/policy/') ||
    pathname.startsWith('/policy-files')
  ) {
    return 'policies';
  }

  if (pathname.startsWith('/profile')) {
    return 'account';
  }

  return 'dashboard';
}

function WebAuthSidebar() {
  const pathname = usePathname();
  const activeNavKey = useMemo(() => toActiveNavKey(pathname), [pathname]);

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <BrandMark compactWordmark />
      </View>
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeNavKey;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (item.href === '/(tabs)') {
                  router.replace('/(tabs)');
                  return;
                }
                router.push(item.href);
              }}
              style={({ pressed }) => [
                styles.navItem,
                isActive ? styles.navItemActive : null,
                pressed ? styles.navItemPressed : null,
              ]}>
              <Text style={[styles.navText, isActive ? styles.navTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function WebAuthShell({ children }: PropsWithChildren) {
  const isDesktopLayout = useIsDesktopWebLayout();

  if (!isDesktopLayout) {
    return <>{children}</>;
  }

  return (
    <ScreenContainerSettingsProvider maxContentWidth={DESKTOP_MAX_CONTENT_WIDTH}>
      <View style={styles.shell}>
        <WebAuthSidebar />
        <View style={styles.content}>{children}</View>
      </View>
    </ScreenContainerSettingsProvider>
  );
}

export function WebProtectedShell({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState title="Securing your session" description="Redirecting to login..." />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <WebAuthShell>{children}</WebAuthShell>;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  sidebar: {
    width: 248,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sidebarHeader: {
    gap: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  navList: {
    gap: theme.spacing.xs,
  },
  navItem: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  navItemActive: {
    backgroundColor: '#EAF3EE',
    borderColor: '#C6D8CF',
  },
  navItemPressed: {
    opacity: 0.9,
  },
  navText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  navTextActive: {
    color: theme.colors.primaryDeep,
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
});
