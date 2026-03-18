import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { BrandMark } from '@/components/brand-mark';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen() {
  const { setPendingEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = () => {
    if (!isEmailValid(email)) {
      setError('Enter a valid email address to continue.');
      return;
    }

    setSubmitting(true);
    setError('');
    setPendingEmail(email);

    setTimeout(() => {
      setSubmitting(false);
      router.push('/(auth)/verify');
    }, 450);
  };

  return (
    <ScreenContainer scroll={false}>
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
  disclaimer: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    textAlign: 'center',
  },
});
