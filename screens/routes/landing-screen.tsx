import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandMark } from '@/components/brand-mark';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const LANDING_VISUAL_IMAGE = require('../../assets/images/imageWorker.png');
const OFFERINGS = [
  'Commercial General Liability (CGL)',
  'Construction Bonds',
  "Workers' Compensation",
  'Inland Marine Insurance',
  'Excess / Umbrella Coverage',
  'Commercial Auto Insurance',
  'Professional Liability (Errors & Omissions)',
  'Pollution Liability',
] as const;

export default function LandingScreen() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 1080;
  const showMobileVisual = !isDesktop;
  const isCompactMobileHeight = showMobileVisual && height <= 760;
  const isVeryCompactMobileHeight = showMobileVisual && height <= 700;
  const isResponsiveWeb = Platform.OS === 'web' && showMobileVisual;
  const maxContentWidth = showMobileVisual ? width : 1280;
  const responsiveWebViewportStyle = isResponsiveWeb ? { height } : null;

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoadingAuth]);

  if (isLoadingAuth) {
    return (
      <ScreenContainer
        scroll={false}
        maxContentWidth={maxContentWidth}
        includeTopInset={!showMobileVisual}
        style={showMobileVisual ? styles.mobileScreenContainer : undefined}>
        <LoadingState title="Restoring session" description="Checking your secure login state..." />
      </ScreenContainer>
    );
  }

  const heroCard = (
    <View
      style={[
        styles.heroCard,
        isDesktop ? styles.heroCardDesktop : null,
        showMobileVisual ? styles.mobileHeroCard : null,
        isCompactMobileHeight ? styles.mobileHeroCardCompact : null,
      ]}>
      <View style={styles.heroRule} />
      <Text style={[styles.eyebrow, showMobileVisual ? styles.mobileEyebrow : null]}>
        FAST. RELIABLE. BUILT FOR CONTRACTORS.
      </Text>
      <Text
        style={[
          styles.title,
          isDesktop ? styles.titleDesktop : null,
          showMobileVisual ? styles.mobileTitle : null,
          isCompactMobileHeight ? styles.mobileTitleCompact : null,
          isVeryCompactMobileHeight ? styles.mobileTitleVeryCompact : null,
        ]}>
        Stay insured. Stay compliant. Get to work.
      </Text>
      <Text
        style={[
          styles.subtitle,
          showMobileVisual ? styles.mobileSubtitle : null,
          isCompactMobileHeight ? styles.mobileSubtitleCompact : null,
        ]}>
        Access your policies, download certificates, and manage your coverage anytime.
      </Text>
    </View>
  );

  const ctaBlock = (
    <View
      style={[
        styles.cta,
        showMobileVisual ? styles.mobileCta : null,
        isCompactMobileHeight ? styles.mobileCtaCompact : null,
      ]}>
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
      <Text
        style={[
          styles.caption,
          showMobileVisual ? styles.mobileCaption : null,
          isCompactMobileHeight ? styles.mobileCaptionCompact : null,
        ]}>
        One-time verification helps protect your account.
      </Text>
    </View>
  );

  const offeringsBlock = (
    <View
      style={[
        styles.offeringsCard,
        showMobileVisual ? styles.mobileOfferingsCard : null,
        isCompactMobileHeight ? styles.mobileOfferingsCardCompact : null,
      ]}>
      <Text
        style={[
          styles.offeringsTitle,
          showMobileVisual ? styles.mobileOfferingsTitle : null,
          isCompactMobileHeight ? styles.mobileOfferingsTitleCompact : null,
        ]}>
        What We Offer
      </Text>
      <View
        style={[
          styles.offeringsGrid,
          showMobileVisual ? styles.mobileOfferingsGrid : null,
          isCompactMobileHeight ? styles.mobileOfferingsGridCompact : null,
        ]}>
        {OFFERINGS.map((item) => (
          <View
            key={item}
            style={[
              styles.offeringPill,
              showMobileVisual ? styles.mobileOfferingPill : null,
              isCompactMobileHeight ? styles.mobileOfferingPillCompact : null,
              isVeryCompactMobileHeight ? styles.mobileOfferingPillVeryCompact : null,
            ]}>
            <Text
              style={[
                styles.offeringText,
                showMobileVisual ? styles.mobileOfferingText : null,
                isCompactMobileHeight ? styles.mobileOfferingTextCompact : null,
              ]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ScreenContainer
      scroll={false}
      maxContentWidth={maxContentWidth}
      includeTopInset={!showMobileVisual}
      style={showMobileVisual ? styles.mobileScreenContainer : undefined}>
      <View style={[styles.page, isResponsiveWeb ? styles.responsiveWebPage : null, responsiveWebViewportStyle]}>
        <View
          style={[
            styles.desktopFrame,
            isDesktop ? styles.desktopFrameActive : null,
            isResponsiveWeb ? styles.responsiveWebFrame : null,
            responsiveWebViewportStyle,
          ]}>
          <View style={[styles.leftColumn, isDesktop ? styles.leftColumnDesktop : null]}>
            {showMobileVisual ? (
              <View
                style={[
                  styles.mobileVisualCanvas,
                  isResponsiveWeb ? styles.responsiveWebVisualCanvas : null,
                  responsiveWebViewportStyle,
                ]}>
                <Image source={LANDING_VISUAL_IMAGE} style={styles.mobileVisualImage} resizeMode="cover" />
                <View style={styles.visualImageScrim} />

                  <View
                  style={[
                    styles.mobileOverlayContent,
                    isCompactMobileHeight ? styles.mobileOverlayContentCompact : null,
                    {
                      paddingTop: insets.top + theme.spacing.sm,
                      paddingBottom: insets.bottom + (isCompactMobileHeight ? theme.spacing.sm : theme.spacing.md),
                    },
                  ]}>
                  <View style={[styles.mobileHeader, isCompactMobileHeight ? styles.mobileHeaderCompact : null]}>
                    <BrandMark />
                  </View>
                  <View
                    style={[
                      styles.mobileBottomContent,
                      isCompactMobileHeight ? styles.mobileBottomContentCompact : null,
                    ]}>
                    {heroCard}
                    {offeringsBlock}
                    {ctaBlock}
                  </View>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.top}>
                  <BrandMark />
                </View>

                <View style={styles.heroWrap}>
                  <View pointerEvents="none" style={styles.heroStructure} />
                  <View pointerEvents="none" style={styles.heroBracket} />
                  <View pointerEvents="none" style={styles.heroBrace} />
                  {heroCard}
                </View>

                {offeringsBlock}
                {ctaBlock}
              </>
            )}
          </View>

          {isDesktop ? (
            // Desktop intentionally uses a separate visual column so the CTA stack stays focused and readable.
            <View
              pointerEvents="none"
              style={styles.visualColumn}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <View style={styles.visualCanvas}>
                <Image source={LANDING_VISUAL_IMAGE} style={styles.visualImage} resizeMode="cover" />
                <View style={styles.visualImageScrim} />
                <View style={styles.visualGlowTop} />
                <View style={styles.visualGlowBottom} />
                <View style={styles.visualGridHorizontal} />
                <View style={styles.visualGridVertical} />

                <View style={[styles.visualShape, styles.visualShapeA]} />
                <View style={[styles.visualShape, styles.visualShapeB]} />

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
  mobileScreenContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  page: {
    flex: 1,
  },
  responsiveWebPage: {
    overflow: 'hidden',
  },
  desktopFrame: {
    flex: 1,
  },
  responsiveWebFrame: {
    overflow: 'hidden',
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
  mobileHeroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderColor: 'rgba(211, 223, 217, 0.95)',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  mobileHeroCardCompact: {
    padding: theme.spacing.sm,
    gap: 6,
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
  mobileTitle: {
    fontSize: 28,
    lineHeight: 33,
  },
  mobileTitleCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  mobileTitleVeryCompact: {
    fontSize: 22,
    lineHeight: 26,
  },
  subtitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  mobileEyebrow: {
    color: theme.colors.primary,
  },
  mobileSubtitle: {
    color: theme.colors.textStrong,
  },
  mobileSubtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  offeringsCard: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  mobileOfferingsCard: {
    marginTop: 0,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    padding: theme.spacing.sm,
  },
  mobileOfferingsCardCompact: {
    padding: theme.spacing.xs,
    gap: 6,
  },
  offeringsTitle: {
    ...theme.typography.label,
    color: theme.colors.primaryDeep,
    textAlign: 'center',
  },
  mobileOfferingsTitle: {
    color: '#FFFFFF',
  },
  mobileOfferingsTitleCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  offeringsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  mobileOfferingsGrid: {
    gap: 6,
  },
  mobileOfferingsGridCompact: {
    gap: 4,
  },
  offeringPill: {
    width: '48%',
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#C6D8CF',
    backgroundColor: '#EAF3EE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
  },
  mobileOfferingPill: {
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(7, 26, 18, 0.26)',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 6,
  },
  mobileOfferingPillCompact: {
    minHeight: 40,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  mobileOfferingPillVeryCompact: {
    minHeight: 36,
  },
  offeringText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primaryDeep,
    fontWeight: '700',
    textAlign: 'center',
  },
  mobileOfferingText: {
    ...theme.typography.bodySmall,
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
  },
  mobileOfferingTextCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  cta: {
    marginTop: 'auto',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  mobileCta: {
    marginTop: 0,
    paddingBottom: 0,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    backgroundColor: 'rgba(7, 26, 18, 0.20)',
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  mobileCtaCompact: {
    padding: theme.spacing.xs,
    gap: 6,
  },
  caption: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    textAlign: 'center',
  },
  mobileCaption: {
    color: 'rgba(255, 255, 255, 0.92)',
  },
  mobileCaptionCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  mobileVisualCanvas: {
    flex: 1,
    minHeight: 0,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#C9D9D2',
    backgroundColor: '#EAF3EE',
    overflow: 'hidden',
  },
  responsiveWebVisualCanvas: {
    minHeight: 0,
    height: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  mobileVisualImage: {
    position: 'absolute',
    top: -180,
    left: -248,
    width: '170%',
    height: '132%',
  },
  mobileOverlayContent: {
    ...StyleSheet.absoluteFillObject,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  mobileOverlayContentCompact: {
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  mobileHeader: {
    marginTop: theme.spacing.xs,
  },
  mobileHeaderCompact: {
    marginTop: 0,
  },
  mobileBottomContent: {
    marginTop: 'auto',
    gap: theme.spacing.sm,
  },
  mobileBottomContentCompact: {
    gap: theme.spacing.xs,
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
  visualImage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -130,
    width: '129%',
    height: '100%',
  },
  visualImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 78, 57, 0.38)',
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
  mobileVisualShapeA: {
    top: 124,
    left: 18,
    width: 170,
    height: 126,
    transform: [{ rotate: '-10deg' }],
  },
  mobileVisualShapeB: {
    right: -12,
    bottom: 206,
    width: 150,
    height: 112,
    transform: [{ rotate: '10deg' }],
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
