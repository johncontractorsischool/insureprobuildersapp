import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { BrandMark } from '@/components/brand-mark';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { fetchCustomersByEmail } from '@/services/customer-api';
import { isOtpRateLimitError, sendEmailSignInCode, toUserFacingError } from '@/services/auth-flow';

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen() {
  const { setPendingEmail, setCustomer } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  return (
    <ScreenContainer scroll={false}>
      <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button">
        <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <BrandMark />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sign in to your secure portal</Text>
        <Text style={styles.subtitle}>
          Enter the email associated with your policies. We will send a one-time verification code.
        </Text>

        <AppInput
          label="Email address"
          leftIcon="mail-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@company.com"
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          errorText={error}
          helperText="We only use this for secure account verification."
        />

        <AppButton label="Continue" onPress={handleContinue} loading={submitting} />

        <Text style={styles.disclaimer}>
          Your login session is encrypted and protected with one-time code verification.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
});
