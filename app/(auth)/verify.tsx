import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandMark } from '@/components/brand-mark';
import { OTPInput } from '@/components/otp-input';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const first = name.charAt(0);
  const last = name.charAt(name.length - 1);
  const middle = '*'.repeat(Math.max(2, name.length - 2));
  return `${first}${middle}${last}@${domain}`;
}

export default function VerifyScreen() {
  const { pendingEmail, completeSignIn } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (!pendingEmail) router.replace('/(auth)/login');
  }, [pendingEmail]);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => setSecondsRemaining((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const maskedEmail = useMemo(() => maskEmail(pendingEmail), [pendingEmail]);

  const handleContinue = () => {
    if (code.replace(/\D/g, '').length !== 6 || !pendingEmail) return;

    setSubmitting(true);
    setTimeout(() => {
      completeSignIn(pendingEmail);
      setSubmitting(false);
      router.replace('/(tabs)');
    }, 600);
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
            onPress={() => setSecondsRemaining(30)}
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

        <Text style={styles.disclaimer}>
          Demo mode: use any 6 digits. Backend OTP validation will be connected later.
        </Text>
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
});
