import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { BrandMark } from '@/components/brand-mark';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { CslbMomentumSignUpForm } from '@/screens/routes/auth/cslb-momentum-sign-up-form';
import { fetchCustomersByEmail } from '@/services/customer-api';
import { isOtpRateLimitError, sendEmailSignInCode, toUserFacingError } from '@/services/auth-flow';

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const LOGIN_VISUAL_IMAGE = require('../../../assets/images/imageWorker.png');

type AuthMode = 'signin' | 'signup';

function getAuthModeFromParam(value: string | string[] | undefined): AuthMode {
  const token = Array.isArray(value) ? value[0] : value;
  return token === 'signup' ? 'signup' : 'signin';
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { setPendingEmail, setCustomer } = useAuth();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<AuthMode>(getAuthModeFromParam(params.mode));
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isDesktop = width >= 1100;
  const isTablet = width >= 760;
  const showDesktopVisual = isDesktop;
  const maxContentWidth = isDesktop ? 1240 : isTablet ? 820 : undefined;

  useEffect(() => {
    setMode(getAuthModeFromParam(params.mode));
  }, [params.mode]);

  const handleContinue = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isEmailValid(normalizedEmail)) {
      setError('Enter a valid email address to continue.');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const customers = await fetchCustomersByEmail(normalizedEmail);

      if (customers.length === 0) {
        setError('No account was found for that email address.');
        return;
      }

      await sendEmailSignInCode(normalizedEmail);

      setPendingEmail(normalizedEmail);
      setCustomer(null);
      router.push('/(auth)/verify');
    } catch (caughtError) {
      if (isOtpRateLimitError(caughtError)) {
        setPendingEmail(normalizedEmail);
        setCustomer(null);
        router.push({ pathname: '/(auth)/verify', params: { hint: 'rate-limited' } });
        return;
      }

      setError(
        toUserFacingError(
          caughtError,
          'We could not start secure sign in. Please try again in a moment.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    if (nextMode === 'signup') setError('');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  return (
    <ScreenContainer
      maxContentWidth={maxContentWidth}
      keyboardAware={!isDesktop}
      keyboardVerticalOffset={theme.spacing.md}
      contentContainerStyle={!isDesktop ? styles.mobileContent : undefined}>
      <View style={styles.page}>
        <View style={[styles.desktopFrame, isDesktop ? styles.desktopFrameActive : null]}>
          <View style={[styles.authColumn, isDesktop ? styles.authColumnDesktop : null]}>
            <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button">
              <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <View style={styles.header}>
              <BrandMark />
            </View>

            <View style={[styles.card, isDesktop ? styles.cardDesktop : null]}>
              <View style={styles.modeSwitch}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleModeChange('signin')}
                  style={[styles.modeButton, mode === 'signin' ? styles.modeButtonActive : null]}>
                  <Text style={[styles.modeButtonText, mode === 'signin' ? styles.modeButtonTextActive : null]}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleModeChange('signup')}
                  style={[styles.modeButton, mode === 'signup' ? styles.modeButtonActive : null]}>
                  <Text style={[styles.modeButtonText, mode === 'signup' ? styles.modeButtonTextActive : null]}>
                    Sign Up
                  </Text>
                </Pressable>
              </View>

              {mode === 'signin' ? (
                <>
                  <Text style={styles.title}>Sign In</Text>
                  <Text style={styles.subtitle}>
                    Enter the email associated with your policies. We will send a one-time verification code.
                  </Text>

                  <AppInput
                    label="Email Address"
                    leftIcon="mail-outline"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="You@Company.com"
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                    errorText={error}
                    helperText="We only use this for secure account verification."
                  />

                  <AppButton label="Continue" onPress={handleContinue} loading={submitting} />

                  <Text style={styles.disclaimer}>
                    Your login session is encrypted and protected with one-time code verification.
                  </Text>
                </>
              ) : (
                <CslbMomentumSignUpForm />
              )}
            </View>
          </View>

          {showDesktopVisual ? (
            // Keep the desktop shell stable across Sign In and Sign Up to avoid jarring layout jumps when toggling tabs.
            <View
              pointerEvents="none"
              style={styles.visualColumn}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <View style={styles.visualCanvas}>
                <Image source={LOGIN_VISUAL_IMAGE} style={styles.visualImage} resizeMode="cover" />
                <View style={styles.visualImageScrim} />
                <View style={styles.visualGlowTop} />
                <View style={styles.visualGlowBottom} />
                <View style={styles.visualGrid} />
                <View style={[styles.visualPanel, styles.visualPanelTop]} />
                <View style={[styles.visualPanel, styles.visualPanelBottom]} />

                <View style={styles.visualOutline} />
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
  // Split layout is only enabled for desktop sign-up so mobile and sign-in remain close to existing behavior.
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
  authColumn: {
    flex: 1,
  },
  authColumnDesktop: {
    maxWidth: 640,
  },
  header: {
    marginTop: theme.spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 8,
  },
  backButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  card: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  cardDesktop: {
    padding: theme.spacing.xxl,
  },
  mobileContent: {
    paddingBottom: theme.spacing.xxxl,
  },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  modeButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: theme.colors.primary,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  disclaimer: {
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
    minHeight: 720,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#C8D9D1',
    backgroundColor: '#EAF3EE',
    overflow: 'hidden',
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
    top: -90,
    left: -60,
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: '#D8ECE2',
  },
  visualGlowBottom: {
    position: 'absolute',
    right: -78,
    bottom: -90,
    width: 330,
    height: 330,
    borderRadius: 999,
    backgroundColor: '#D2E7DC',
  },
  visualGrid: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: '#D8E7E1',
  },
  visualPanel: {
    position: 'absolute',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#C8D9D1',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  visualPanelTop: {
    top: 120,
    left: 56,
    width: 250,
    height: 160,
    transform: [{ rotate: '-8deg' }],
  },
  visualPanelBottom: {
    right: 52,
    bottom: 130,
    width: 220,
    height: 144,
    transform: [{ rotate: '8deg' }],
  },
  visualOutline: {
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
