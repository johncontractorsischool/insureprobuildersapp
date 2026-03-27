import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

function isPhoneValid(value: string) {
  return value.replace(/\D/g, '').length >= 10;
}

type AuthMode = 'signin' | 'signup';

type SignUpForm = {
  licenseOrAppFeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

type SignUpErrors = Partial<Record<keyof SignUpForm, string>>;

const SIGN_UP_DEFAULT_FORM: SignUpForm = {
  licenseOrAppFeeNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
};

function getAuthModeFromParam(value: string | string[] | undefined): AuthMode {
  const token = Array.isArray(value) ? value[0] : value;
  return token === 'signup' ? 'signup' : 'signin';
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { setPendingEmail, setCustomer } = useAuth();
  const [mode, setMode] = useState<AuthMode>(getAuthModeFromParam(params.mode));
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signUpForm, setSignUpForm] = useState<SignUpForm>(SIGN_UP_DEFAULT_FORM);
  const [signUpErrors, setSignUpErrors] = useState<SignUpErrors>({});
  const [signUpNotice, setSignUpNotice] = useState('');

  useEffect(() => {
    setMode(getAuthModeFromParam(params.mode));
  }, [params.mode]);

  const hasSignUpErrors = useMemo(() => Object.keys(signUpErrors).length > 0, [signUpErrors]);

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

  const updateSignUpField = (field: keyof SignUpForm, value: string) => {
    setSignUpForm((previous) => ({ ...previous, [field]: value }));
    setSignUpNotice('');
    setSignUpErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const handleSignUp = () => {
    const normalizedForm: SignUpForm = {
      licenseOrAppFeeNumber: signUpForm.licenseOrAppFeeNumber.trim(),
      firstName: signUpForm.firstName.trim(),
      lastName: signUpForm.lastName.trim(),
      email: signUpForm.email.trim().toLowerCase(),
      phoneNumber: signUpForm.phoneNumber.trim(),
    };

    const nextErrors: SignUpErrors = {};

    if (!normalizedForm.licenseOrAppFeeNumber) {
      nextErrors.licenseOrAppFeeNumber = 'Enter your license number or app fee number.';
    }
    if (!normalizedForm.firstName) {
      nextErrors.firstName = 'First name is required.';
    }
    if (!normalizedForm.lastName) {
      nextErrors.lastName = 'Last name is required.';
    }
    if (!isEmailValid(normalizedForm.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!normalizedForm.phoneNumber) {
      nextErrors.phoneNumber = 'Phone number is required.';
    } else if (!isPhoneValid(normalizedForm.phoneNumber)) {
      nextErrors.phoneNumber = 'Enter a valid phone number.';
    }

    setSignUpErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSignUpNotice('');
      return;
    }

    setSignUpForm(normalizedForm);
    setSignUpNotice('Sign-up details look good. We will connect this form to the backend endpoint next.');
  };

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    if (nextMode === 'signin') {
      setSignUpNotice('');
      return;
    }
    setError('');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  return (
    <ScreenContainer>
      <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button">
        <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <BrandMark />
      </View>

      <View style={styles.card}>
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
          </>
        ) : (
          <>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Complete all required fields below. License Number or App Fee Number is mandatory.
            </Text>

            <AppInput
              label="License Number or App Fee Number"
              leftIcon="document-text-outline"
              value={signUpForm.licenseOrAppFeeNumber}
              onChangeText={(value) => updateSignUpField('licenseOrAppFeeNumber', value)}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="License # or App Fee #"
              errorText={signUpErrors.licenseOrAppFeeNumber}
            />

            <AppInput
              label="First Name"
              leftIcon="person-outline"
              value={signUpForm.firstName}
              onChangeText={(value) => updateSignUpField('firstName', value)}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="First name"
              errorText={signUpErrors.firstName}
            />

            <AppInput
              label="Last Name"
              leftIcon="person-outline"
              value={signUpForm.lastName}
              onChangeText={(value) => updateSignUpField('lastName', value)}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Last name"
              errorText={signUpErrors.lastName}
            />

            <AppInput
              label="Email"
              leftIcon="mail-outline"
              value={signUpForm.email}
              onChangeText={(value) => updateSignUpField('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@company.com"
              errorText={signUpErrors.email}
            />

            <AppInput
              label="Phone Number"
              leftIcon="call-outline"
              value={signUpForm.phoneNumber}
              onChangeText={(value) => updateSignUpField('phoneNumber', value)}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="(555) 555-5555"
              errorText={signUpErrors.phoneNumber}
            />

            <AppButton label="Submit Sign Up" onPress={handleSignUp} />

            {signUpNotice ? <Text style={styles.noticeText}>{signUpNotice}</Text> : null}
            {!signUpNotice && hasSignUpErrors ? (
              <Text style={styles.errorSummary}>Please fix the required fields and try again.</Text>
            ) : null}
          </>
        )}
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
  noticeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.success,
    textAlign: 'center',
  },
  errorSummary: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
    textAlign: 'center',
  },
});
