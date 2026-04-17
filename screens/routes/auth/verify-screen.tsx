import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/app-button';
import { BrandMark } from '@/components/brand-mark';
import { OTPInput } from '@/components/otp-input';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { fetchCustomersByEmail } from '@/services/customer-api';
import {
  isOtpRateLimitError,
  persistCustomersForEmail,
  sendEmailSignInCode,
  toCustomerProfile,
  toUserFacingError,
  verifyEmailSignInCode,
} from '@/services/auth-flow';
import { pickPreferredCustomerLookup } from '@/utils/customer-selection';

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const first = name.charAt(0);
  const last = name.charAt(name.length - 1);
  const middle = '*'.repeat(Math.max(2, name.length - 2));
  return `${first}${middle}${last}@${domain}`;
}

export default function VerifyScreen() {
  const { hint } = useLocalSearchParams<{ hint?: string }>();
  const { pendingEmail, pendingInsuredId, completeSignIn } = useAuth();
  const { width } = useWindowDimensions();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isDesktop = width >= 1100;
  const isTablet = width >= 760;
  const maxContentWidth = isDesktop ? 1240 : isTablet ? 820 : undefined;

  useEffect(() => {
    if (!pendingEmail) router.replace('/(auth)/login');
  }, [pendingEmail]);

  useEffect(() => {
    if (hint !== 'rate-limited') return;
    setNotice('Use your latest verification code, or wait before requesting another email.');
    setSecondsRemaining(60);
  }, [hint]);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => setSecondsRemaining((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const maskedEmail = useMemo(() => maskEmail(pendingEmail), [pendingEmail]);

  const handleContinue = async () => {
    if (code.replace(/\D/g, '').length !== 6 || !pendingEmail) return;
    if (submitting) return;

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const verifiedEmail = await verifyEmailSignInCode(pendingEmail, code);
      let customerProfile;
      try {
        const customers = await fetchCustomersByEmail(verifiedEmail);
        if (customers.length > 0) {
          const primaryCustomer = pickPreferredCustomerLookup(customers, pendingInsuredId);
          if (primaryCustomer) {
            customerProfile = toCustomerProfile(primaryCustomer);
            try {
              await persistCustomersForEmail(verifiedEmail, customers);
            } catch (persistError) {
              // Keep the fresh customer profile in memory even if the Supabase cache write is blocked.
              console.warn('Customer cache sync failed after successful OTP verification.', persistError);
            }
          }
        }
      } catch (syncError) {
        // OTP verification already succeeded. Keep sign-in valid even if profile sync is temporarily unavailable.
        console.warn('Customer sync failed after successful OTP verification.', syncError);
      }

      completeSignIn(verifiedEmail, customerProfile, customerProfile?.insuredId ?? pendingInsuredId);
      router.replace('/(tabs)');
    } catch (caughtError) {
      setError(toUserFacingError(caughtError, 'Unable to verify code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || secondsRemaining > 0) return;

    setError('');
    setNotice('');
    try {
      await sendEmailSignInCode(pendingEmail);
      setSecondsRemaining(60);
    } catch (caughtError) {
      if (isOtpRateLimitError(caughtError)) {
        setSecondsRemaining(60);
        setNotice('A code may already be in your inbox. Please wait and then try resend.');
        return;
      }
      setError(toUserFacingError(caughtError, 'Unable to resend code right now.'));
    }
  };

  return (
    <ScreenContainer scroll={false} maxContentWidth={maxContentWidth}>
      <View style={styles.page}>
        <View style={[styles.desktopFrame, isDesktop ? styles.desktopFrameActive : null]}>
          <View style={[styles.verifyColumn, isDesktop ? styles.verifyColumnDesktop : null]}>
            <View style={styles.header}>
              <BrandMark />
            </View>

            <View style={[styles.card, isDesktop ? styles.cardDesktop : null]}>
              <Text style={styles.title}>Enter Verification Code</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to {maskedEmail || 'your email address'}.
              </Text>

              <OTPInput value={code} onChange={setCode} />

              <View style={styles.actions}>
                <Pressable
                  onPress={handleResend}
                  disabled={secondsRemaining > 0}
                  style={styles.inlineAction}>
                  <Text style={[styles.link, secondsRemaining > 0 ? styles.linkDisabled : null]}>
                    {secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : 'Resend Code'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.inlineAction}>
                  <Text style={styles.link}>Change Email</Text>
                </Pressable>
              </View>

              <AppButton
                label="Verify and Continue"
                onPress={handleContinue}
                loading={submitting}
                disabled={code.replace(/\D/g, '').length !== 6}
              />

              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Text style={styles.disclaimer}>Use the code sent to your email to complete secure sign in.</Text>
            </View>
          </View>

          {isDesktop ? (
            // Keep the verification card constrained and dominant while desktop space is used for supportive brand context.
            <View
              pointerEvents="none"
              style={styles.visualColumn}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <View style={styles.visualCanvas}>
                <View style={styles.visualGlowTop} />
                <View style={styles.visualGlowBottom} />
                <View style={styles.visualGrid} />
                <View style={[styles.visualPanel, styles.visualPanelTop]} />
                <View style={[styles.visualPanel, styles.visualPanelBottom]} />

                <View style={styles.emblemWrap}>
                  <View style={styles.emblemOuter}>
                    <View style={styles.emblemInner}>
                      <Ionicons name="shield-checkmark-outline" size={34} color={theme.colors.primaryDeep} />
                    </View>
                  </View>
                </View>

                <View style={[styles.iconTile, styles.iconTileOne]}>
                  <Ionicons name="key-outline" size={24} color={theme.colors.primary} />
                </View>
                <View style={[styles.iconTile, styles.iconTileTwo]}>
                  <Ionicons name="mail-open-outline" size={24} color={theme.colors.primary} />
                </View>
                <View style={[styles.iconTile, styles.iconTileThree]}>
                  <Ionicons name="checkmark-done-outline" size={24} color={theme.colors.primary} />
                </View>

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
  verifyColumn: {
    flex: 1,
  },
  verifyColumnDesktop: {
    maxWidth: 640,
  },
  header: {
    marginTop: theme.spacing.sm,
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
  title: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: theme.spacing.xs,
  },
  inlineAction: {
    paddingVertical: 4,
  },
  link: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  linkDisabled: {
    color: theme.colors.textSubtle,
  },
  disclaimer: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    textAlign: 'center',
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  noticeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  visualColumn: {
    flex: 1,
    minWidth: 460,
  },
  visualCanvas: {
    flex: 1,
    minHeight: 680,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#C8D9D1',
    backgroundColor: '#EAF3EE',
    overflow: 'hidden',
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
  emblemWrap: {
    position: 'absolute',
    top: '36%',
    left: '50%',
    marginLeft: -78,
    marginTop: -78,
  },
  emblemOuter: {
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#C4D6CD',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.elevated,
  },
  emblemInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: '#C6D8CF',
    backgroundColor: '#EAF3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#C6D8CF',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.surface,
  },
  iconTileOne: {
    top: 122,
    right: 84,
  },
  iconTileTwo: {
    bottom: 164,
    left: 78,
  },
  iconTileThree: {
    bottom: 96,
    right: 116,
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
