import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCslbMomentumSync } from '@/hooks/use-cslb-momentum-sync';

export function CslbMomentumSignUpForm() {
  const { setPendingEmail, setCustomer } = useAuth();
  const {
    form,
    errors,
    uiState,
    isSubmitting,
    errorMessage,
    updateField,
    validateField,
    submit,
  } = useCslbMomentumSync();

  const handleCreateAccount = async () => {
    const result = await submit();
    if (!result) return;

    setPendingEmail(result.email);
    setCustomer(null);

    if (result.rateLimited) {
      router.push({ pathname: '/(auth)/verify', params: { hint: 'rate-limited' } });
      return;
    }

    router.push('/(auth)/verify');
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>
        We will sync your CSLB + Momentum data using your submitted details.
      </Text>

      <AppInput
        label="First Name"
        leftIcon="person-outline"
        value={form.firstName}
        onChangeText={(value) => updateField('firstName', value)}
        onBlur={() => validateField('firstName')}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="First name"
        errorText={errors.firstName}
      />

      <AppInput
        label="Last Name"
        leftIcon="person-outline"
        value={form.lastName}
        onChangeText={(value) => updateField('lastName', value)}
        onBlur={() => validateField('lastName')}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="Last name"
        errorText={errors.lastName}
      />

      <AppInput
        label="Email"
        leftIcon="mail-outline"
        value={form.email}
        onChangeText={(value) => updateField('email', value)}
        onBlur={() => validateField('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="you@company.com"
        errorText={errors.email}
      />

      <AppInput
        label="License Number"
        leftIcon="document-text-outline"
        value={form.licenseNumber}
        onChangeText={(value) => updateField('licenseNumber', value)}
        onBlur={() => validateField('licenseNumber')}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="CSLB license number"
        errorText={errors.licenseNumber}
      />

      <AppInput
        label="App Fee Number"
        leftIcon="document-attach-outline"
        value={form.appFeeNumber}
        onChangeText={(value) => updateField('appFeeNumber', value)}
        onBlur={() => validateField('appFeeNumber')}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="App fee number"
        errorText={errors.appFeeNumber}
        helperText="If both values are entered, App Fee Number is used for sync priority."
      />

      <View style={styles.actionsRow}>
        <AppButton
          label="Create Account"
          onPress={handleCreateAccount}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
      </View>

      {uiState === 'loading' ? (
        <Text testID="sync-loading-state" style={styles.noticeText}>
          Creating your account...
        </Text>
      ) : null}

      {uiState === 'error' && errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Sync failed</Text>
          <Text testID="sync-error-message" style={styles.errorBody}>
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.md,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  actionsRow: {
    gap: theme.spacing.sm,
  },
  noticeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  errorCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  errorTitle: {
    ...theme.typography.label,
    color: theme.colors.danger,
  },
  errorBody: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
});
