import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/app-button';
import { BrandMark } from '@/components/brand-mark';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const featurePills = [
  'Instant certificate downloads',
  'CSLB-compliant coverage',
  'Manage payments & renewals',
];

export default function LandingScreen() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1080;
  const isTablet = width >= 760;
  const maxContentWidth = isDesktop ? 1280 : isTablet ? 860 : undefined;

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoadingAuth]);

  if (isLoadingAuth) {
    return (
      <ScreenContainer scroll={false} maxContentWidth={maxContentWidth}>
        <LoadingState title="Restoring session" description="Checking your secure login state..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} maxContentWidth={maxContentWidth}>
      <View style={styles.page}>
        <View style={[styles.desktopFrame, isDesktop ? styles.desktopFrameActive : null]}>
          <View style={[styles.leftColumn, isDesktop ? styles.leftColumnDesktop : null]}>
            <View style={styles.top}>
              <BrandMark />
            </View>

            <View style={styles.heroWrap}>
              <View pointerEvents="none" style={styles.heroStructure} />
              <View pointerEvents="none" style={styles.heroBracket} />
              <View pointerEvents="none" style={styles.heroBrace} />

              <View style={[styles.heroCard, isDesktop ? styles.heroCardDesktop : null]}>
                <View style={styles.heroRule} />
                <Text style={styles.eyebrow}>FAST. RELIABLE. BUILT FOR CONTRACTORS.</Text>
                <Text style={[styles.title, isDesktop ? styles.titleDesktop : null]}>
                  Stay insured. Stay compliant. Get to work.
                </Text>
                <Text style={styles.subtitle}>
                  Access your policies, download certificates, and manage your coverage anytime.
                </Text>

                <View style={styles.trustPills}>
                  {featurePills.map((item) => (
                    <View key={item} style={styles.pill}>
                      <View style={styles.pillMarker} />
                      <Text style={styles.pillText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.cta}>
              <AppButton
                label="Access Your Account"
                onPress={() => (isAuthenticated ? router.replace('/(tabs)') : router.push('/(auth)/login'))}
              />
              {!isAuthenticated ? (
                <AppButton
                  label="Sign Up"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/(auth)/login', params: { mode: 'signup' } })}
                />
              ) : null}
              <Text style={styles.caption}>One-time verification helps protect your account.</Text>
            </View>
          </View>

          {isDesktop ? (
            // Desktop intentionally uses a separate visual column so the CTA stack stays focused and readable.
            <View
              pointerEvents="none"
              style={styles.visualColumn}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <View style={styles.visualCanvas}>
                <View style={styles.visualGlowTop} />
                <View style={styles.visualGlowBottom} />
                <View style={styles.visualGridHorizontal} />
                <View style={styles.visualGridVertical} />

                <View style={[styles.visualShape, styles.visualShapeA]} />
                <View style={[styles.visualShape, styles.visualShapeB]} />

                <View style={styles.emblemWrap}>
                  <View style={styles.emblemOuter}>
                    <View style={styles.emblemInner}>
                      <Ionicons name="construct-outline" size={30} color={theme.colors.primaryDeep} />
                    </View>
                  </View>
                </View>

                <View style={[styles.iconTile, styles.iconTileOne]}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.primary} />
                </View>
                <View style={[styles.iconTile, styles.iconTileTwo]}>
                  <Ionicons name="document-text-outline" size={24} color={theme.colors.primary} />
                </View>
                <View style={[styles.iconTile, styles.iconTileThree]}>
                  <Ionicons name="business-outline" size={24} color={theme.colors.primary} />
                </View>

                <View style={styles.outlineFrame} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  desktopFrame: {
    flex: 1,
  },
  // On large screens this frame creates a balanced two-column hero instead of a narrow centered stack.
  desktopFrameActive: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#D7E2DD',
    backgroundColor: '#F2F7F4',
    padding: theme.spacing.xl,
    ...theme.shadows.surface,
  },
  leftColumn: {
    flex: 1,
  },
  leftColumnDesktop: {
    maxWidth: 580,
  },
  top: {
    marginTop: theme.spacing.sm,
  },
  heroWrap: {
    position: 'relative',
    marginTop: theme.spacing.xs,
  },
  heroStructure: {
    position: 'absolute',
    top: 16,
    right: 0,
    left: 0,
    bottom: -10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#D3DFD9',
    backgroundColor: '#F1F6F3',
  },
  heroBracket: {
    position: 'absolute',
    top: 30,
    right: 20,
    width: 88,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C1D4CC',
  },
  heroBrace: {
    position: 'absolute',
    left: 14,
    bottom: 22,
    width: 6,
    height: 84,
    borderRadius: 3,
    backgroundColor: '#C5D7CF',
  },
  heroCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  heroCardDesktop: {
    padding: theme.spacing.xxl,
  },
  heroRule: {
    width: 84,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  eyebrow: {
    ...theme.typography.label,
    color: theme.colors.primaryDeep,
    letterSpacing: 0.5,
  },
  title: {
    ...theme.typography.display,
    fontSize: 36,
    lineHeight: 42,
    color: theme.colors.textStrong,
  },
  titleDesktop: {
    fontSize: 40,
    lineHeight: 46,
  },
  subtitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  trustPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    backgroundColor: '#EAF3EE',
    borderWidth: 1,
    borderColor: '#C6D8CF',
  },
  pillMarker: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  pillText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primaryDeep,
    fontWeight: '700',
  },
  cta: {
    marginTop: 'auto',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  caption: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    textAlign: 'center',
  },
  visualColumn: {
    flex: 1,
    minWidth: 460,
  },
  visualCanvas: {
    flex: 1,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#C9D9D2',
    backgroundColor: '#EAF3EE',
    overflow: 'hidden',
    minHeight: 620,
  },
  visualGlowTop: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: '#D8ECE2',
  },
  visualGlowBottom: {
    position: 'absolute',
    right: -70,
    bottom: -70,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: '#D2E7DC',
  },
  visualGridHorizontal: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#D9E7E1',
    borderBottomColor: '#D9E7E1',
  },
  visualGridVertical: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: '#D9E7E1',
    borderRightColor: '#D9E7E1',
  },
  visualShape: {
    position: 'absolute',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#C8D9D1',
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
  },
  visualShapeA: {
    top: 110,
    left: 54,
    width: 260,
    height: 168,
    transform: [{ rotate: '-8deg' }],
  },
  visualShapeB: {
    right: 36,
    bottom: 124,
    width: 220,
    height: 150,
    transform: [{ rotate: '9deg' }],
  },
  emblemWrap: {
    position: 'absolute',
    top: '34%',
    left: '50%',
    marginLeft: -74,
    marginTop: -74,
  },
  emblemOuter: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C5D7CF',
    ...theme.shadows.elevated,
  },
  emblemInner: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1,
    borderColor: '#C6D8CF',
    backgroundColor: '#E9F2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C6D8CF',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.surface,
  },
  iconTileOne: {
    top: 108,
    right: 74,
  },
  iconTileTwo: {
    bottom: 138,
    left: 74,
  },
  iconTileThree: {
    bottom: 86,
    right: 112,
  },
  outlineFrame: {
    position: 'absolute',
    top: 24,
    right: 24,
    left: 24,
    bottom: 24,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#CBDBD4',
  },
});
