import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { CustomerLookupRecord } from '@/types/customer';

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
  const { pendingEmail, completeSignIn } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  const pickPrimaryCustomer = (customers: CustomerLookupRecord[]) => {
    return customers.find((entry) => entry.active) ?? customers[0];
  };

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
          await persistCustomersForEmail(verifiedEmail, customers);
          const primaryCustomer = pickPrimaryCustomer(customers);
          customerProfile = toCustomerProfile(primaryCustomer);
        }
      } catch (syncError) {
        // OTP verification already succeeded. Keep sign-in valid even if profile sync is temporarily unavailable.
        console.warn('Customer sync failed after successful OTP verification.', syncError);
      }

      completeSignIn(verifiedEmail, customerProfile);
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
    <ScreenContainer scroll={false}>
      <View style={styles.header}>
        <BrandMark />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Enter verification code</Text>
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
              {secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : 'Resend code'}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.inlineAction}>
            <Text style={styles.link}>Change email</Text>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
});
