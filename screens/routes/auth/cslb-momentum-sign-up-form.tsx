import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCslbMomentumSync } from '@/hooks/use-cslb-momentum-sync';

export function CslbMomentumSignUpForm() {
  const { setPendingEmail, setCustomer } = useAuth();
  const {
    form,
    identifierType,
    errors,
    uiState,
    isSubmitting,
    errorMessage,
    updateField,
    setIdentifierValue,
    setSelectedIdentifierType,
    validateIdentifierField,
    validateField,
    submit,
  } = useCslbMomentumSync();

  const identifierValue = identifierType === 'appFee' ? form.appFeeNumber : form.licenseNumber;
  const identifierError = errors.licenseNumber ?? errors.appFeeNumber;

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

      <AppInput
        label="First Name"
        leftIcon="person-outline"
        value={form.firstName}
        onChangeText={(value) => updateField('firstName', value)}
        onBlur={() => validateField('firstName')}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="First Name"
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
        placeholder="Last Name"
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
        placeholder="You@Company.com"
        errorText={errors.email}
      />

      <View style={styles.identifierToggleWrap}>
        <Text style={styles.identifierToggleLabel}>Identifier Type</Text>
        <View style={styles.identifierToggle}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedIdentifierType('license')}
            style={[
              styles.identifierToggleButton,
              identifierType === 'license' ? styles.identifierToggleButtonActive : null,
            ]}>
            <Text
              style={[
                styles.identifierToggleText,
                identifierType === 'license' ? styles.identifierToggleTextActive : null,
              ]}>
              License Number
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedIdentifierType('appFee')}
            style={[
              styles.identifierToggleButton,
              identifierType === 'appFee' ? styles.identifierToggleButtonActive : null,
            ]}>
            <Text
              style={[
                styles.identifierToggleText,
                identifierType === 'appFee' ? styles.identifierToggleTextActive : null,
              ]}>
              App Fee Number
            </Text>
          </Pressable>
        </View>
      </View>

      <AppInput
        label={identifierType === 'appFee' ? 'App Fee Number' : 'License Number'}
        leftIcon={identifierType === 'appFee' ? 'document-attach-outline' : 'document-text-outline'}
        value={identifierValue}
        onChangeText={setIdentifierValue}
        onBlur={validateIdentifierField}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={identifierType === 'appFee' ? 'App Fee Number' : 'CSLB License Number'}
        errorText={identifierError}
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
  identifierToggleWrap: {
    gap: theme.spacing.xs,
  },
  identifierToggleLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  identifierToggle: {
    flexDirection: 'row',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
    gap: 4,
  },
  identifierToggleButton: {
    flex: 1,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  identifierToggleButtonActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  identifierToggleText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  identifierToggleTextActive: {
    color: theme.colors.primary,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
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
