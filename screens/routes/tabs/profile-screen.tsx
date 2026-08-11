import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { ContactUsMenu } from '@/components/contact-us-menu';
import { DigitalCardEntryPanel } from '@/components/digital-card/digital-card-entry-panel';
import { PushNotificationTestCard } from '@/components/push-notification-test-card';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { createClientContactRequest } from '@/services/contact-request-api';
import { Customer } from '@/types/customer';
import { formatEmailAddress, formatPhoneNumber, getNameFromCustomer } from '@/utils/format';

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

const webWrapText =
  Platform.OS === 'web'
    ? ({ overflowWrap: 'anywhere', wordBreak: 'break-word' } as any)
    : undefined;

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cellPhone: string;
};

type ProfileFieldChange = {
  label: string;
  previousValue: string;
  nextValue: string;
};

function buildFormState(customer: Customer | null, userEmail: string | null): ProfileFormState {
  return {
    firstName: customer?.firstName?.trim() ?? '',
    lastName: customer?.lastName?.trim() ?? '',
    email: formatEmailAddress(customer?.email ?? userEmail ?? ''),
    phone: customer?.phone?.trim() ?? '',
    cellPhone: customer?.cellPhone?.trim() ?? '',
  };
}

function normalizeProfileFieldValue(field: keyof ProfileFormState, value: string) {
  if (field === 'email') {
    return normalizeEmail(value);
  }

  return value.trim();
}

function formatProfileFieldValue(field: keyof ProfileFormState, value: string) {
  if (!value) {
    return 'Blank';
  }

  if (field === 'email') {
    return formatEmailAddress(value) || 'Blank';
  }

  if (field === 'phone' || field === 'cellPhone') {
    return formatPhoneNumber(value) || 'Blank';
  }

  return value;
}

function formatProfileDisplayValue(
  value: string | null | undefined,
  type: 'text' | 'email' | 'phone' = 'text'
) {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return 'Not provided';
  }

  if (type === 'email') {
    return formatEmailAddress(trimmed) || 'Not provided';
  }

  if (type === 'phone') {
    return formatPhoneNumber(trimmed) || 'Not provided';
  }

  return trimmed;
}

function buildProfileFieldChanges(
  existingCustomer: Customer | null,
  userEmail: string | null,
  formState: ProfileFormState
): ProfileFieldChange[] {
  const previousState = buildFormState(existingCustomer, userEmail);
  const fieldLabels: Record<keyof ProfileFormState, string> = {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
    phone: 'Business Number',
    cellPhone: 'Mobile Phone',
  };

  return (Object.keys(fieldLabels) as Array<keyof ProfileFormState>)
    .map((field) => {
      const previousValue = normalizeProfileFieldValue(field, previousState[field]);
      const nextValue = normalizeProfileFieldValue(field, formState[field]);

      if (previousValue === nextValue) {
        return null;
      }

      return {
        label: fieldLabels[field],
        previousValue: formatProfileFieldValue(field, previousValue),
        nextValue: formatProfileFieldValue(field, nextValue),
      };
    })
    .filter((value): value is ProfileFieldChange => Boolean(value));
}

function buildProfileUpdateDescription(changes: ProfileFieldChange[]) {
  return [
    'Profile Update Request',
    '',
    ...changes.map(
      (change) => `${change.label}: ${change.previousValue} -> ${change.nextValue}`
    ),
  ].join('\n');
}

function DetailRow({
  label,
  value,
  valueType = 'text',
}: {
  label: string;
  value: string | null | undefined;
  valueType?: 'text' | 'email' | 'phone';
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, webWrapText]}>{formatProfileDisplayValue(value, valueType)}</Text>
    </View>
  );
}

type ProfileScreenProps = {
  includeTabBarPadding?: boolean;
  isDesktopLayout?: boolean;
};

export default function ProfileScreen({
  includeTabBarPadding = true,
  isDesktopLayout = false,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { customer, userEmail, signOut } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [formState, setFormState] = useState<ProfileFormState>(() => buildFormState(customer, userEmail));
  const accountHolderName = getNameFromCustomer(customer, userEmail);
  const accountEmail = formatProfileDisplayValue(customer?.email ?? userEmail, 'email');

  useEffect(() => {
    if (isEditingProfile) return;
    setFormState(buildFormState(customer, userEmail));
  }, [
    customer?.cellPhone,
    customer?.email,
    customer?.firstName,
    customer?.lastName,
    customer?.phone,
    isEditingProfile,
    userEmail,
  ]);

  const handleLogout = async () => {
    await signOut();
  };

  const handleFormChange = (field: keyof ProfileFormState, value: string) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleStartEdit = () => {
    setFormState(buildFormState(customer, userEmail));
    setProfileError('');
    setProfileNotice('');
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setFormState(buildFormState(customer, userEmail));
    setProfileError('');
    setProfileNotice('');
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    const normalizedEmail = normalizeEmail(formState.email);
    const profileChanges = buildProfileFieldChanges(customer, userEmail, {
      ...formState,
      email: normalizedEmail,
    });

    if (!normalizedEmail || !isEmailValid(normalizedEmail)) {
      setProfileError('Enter a valid email address before saving your profile.');
      return;
    }

    if (profileChanges.length === 0) {
      setProfileError('No profile changes were entered.');
      return;
    }

    const accountId = customer?.accountId?.trim() || customer?.databaseId?.trim() || '';
    const callbackNumber =
      formState.cellPhone.trim() || formState.phone.trim() || customer?.phone?.trim() || '';
    if (!userEmail || !accountId || !callbackNumber) {
      setProfileError('Your PBIA account and a callback number are required to request profile changes.');
      return;
    }

    if (isSavingProfile) return;

    setIsSavingProfile(true);
    setProfileError('');
    setProfileNotice('');

    try {
      await createClientContactRequest(userEmail, {
        accountId,
        callbackNumber,
        preferredContactMethod: 'EMAIL',
        description: buildProfileUpdateDescription(profileChanges),
      });

      setProfileNotice('Your profile update request was submitted to PBIA.');

      setIsEditingProfile(false);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Unable to update your profile right now.';
      setProfileError(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const accountCard = (
    <View style={[styles.accountCard, isDesktopLayout ? styles.desktopCard : null]}>
      <View style={styles.accountHeaderRow}>
        <View style={styles.accountHeaderCopy}>
          <Text style={styles.label}>Account Holder</Text>
          <Text style={styles.name}>{accountHolderName}</Text>
          <Text style={[styles.email, webWrapText]}>{accountEmail}</Text>
        </View>
        {!isEditingProfile ? (
          <View
            style={[
              styles.accountHeaderAction,
              isDesktopLayout ? styles.accountHeaderActionDesktop : styles.accountHeaderActionMobile,
            ]}>
            <AppButton label="Edit Profile" variant="secondary" onPress={handleStartEdit} />
          </View>
        ) : null}
      </View>

      {profileNotice ? <Text style={styles.noticeText}>{profileNotice}</Text> : null}
      {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

      {isEditingProfile ? (
        <View style={styles.editStack}>
          <AppInput
            label="First Name"
            value={formState.firstName}
            onChangeText={(value) => handleFormChange('firstName', value)}
            autoCapitalize="words"
            leftIcon="person-outline"
            placeholder="Jane"
          />
          <AppInput
            label="Last Name"
            value={formState.lastName}
            onChangeText={(value) => handleFormChange('lastName', value)}
            autoCapitalize="words"
            leftIcon="person-outline"
            placeholder="Builder"
          />
          <AppInput
            label="Email Address"
            value={formState.email}
            onChangeText={(value) => handleFormChange('email', value)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            leftIcon="mail-outline"
            placeholder="you@company.com"
          />
          <AppInput
            label="Business Number"
            value={formState.phone}
            onChangeText={(value) => handleFormChange('phone', value)}
            keyboardType="phone-pad"
            leftIcon="call-outline"
            placeholder="5551112222"
          />
          <AppInput
            label="Mobile Phone"
            value={formState.cellPhone}
            onChangeText={(value) => handleFormChange('cellPhone', value)}
            keyboardType="phone-pad"
            leftIcon="phone-portrait-outline"
            placeholder="5559990000"
          />

          <View style={styles.formActions}>
            <AppButton label="Submit Update Request" onPress={handleSaveProfile} loading={isSavingProfile} />
            <AppButton label="Cancel" variant="ghost" onPress={handleCancelEdit} />
          </View>
        </View>
      ) : (
        <View style={styles.detailStack}>
          <DetailRow label="First Name" value={customer?.firstName} />
          <DetailRow label="Last Name" value={customer?.lastName} />
          <DetailRow label="Email Address" value={customer?.email ?? userEmail} valueType="email" />
          <DetailRow label="Business Number" value={customer?.phone} valueType="phone" />
          <DetailRow label="Mobile Phone" value={customer?.cellPhone} valueType="phone" />
        </View>
      )}
    </View>
  );

  const supportBlock = (
    <View style={styles.sideStack}>
      <View style={[styles.contactCard, isDesktopLayout ? styles.desktopCard : null]}>
        <Text style={styles.contactTitle}>Need help with your account?</Text>
        <Text style={styles.contactDetail}>
          Use Contact Us to send a support request or product feedback to our team.
        </Text>
        <AppButton
          label="Need Support"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/contact',
              params: { topic: 'support' },
            })
          }
        />
      </View>

      <View style={styles.footer}>
        <AppButton label="Log out" variant="danger" onPress={handleLogout} />
      </View>
    </View>
  );

  return (
    <ScreenContainer
      contentContainerStyle={[
        { paddingBottom: insets.bottom + (includeTabBarPadding ? 116 : 24) },
        isDesktopLayout ? styles.desktopScreenContent : null,
      ]}>
      <View style={styles.topActionsRow}>
        <ContactUsMenu />
      </View>
      {isDesktopLayout ? (
        // Desktop keeps profile details in a readable primary column with account actions in a calm right rail.
        <View style={styles.desktopLayout}>
          <View style={styles.desktopMainColumn}>
            {accountCard}
            <DigitalCardEntryPanel isDesktopLayout />
            <PushNotificationTestCard isDesktopLayout />
          </View>
          <View style={styles.desktopSideColumn}>{supportBlock}</View>
        </View>
      ) : (
        <>
          {accountCard}
          <DigitalCardEntryPanel />
          <PushNotificationTestCard />
          {supportBlock}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  desktopScreenContent: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  topActionsRow: {
    alignItems: 'flex-end',
  },
  desktopLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  desktopMainColumn: {
    flex: 1.8,
    gap: theme.spacing.md,
    minWidth: 0,
  },
  desktopSideColumn: {
    flex: 1,
    minWidth: 280,
  },
  sideStack: {
    gap: theme.spacing.md,
  },
  desktopCard: {
    borderColor: '#CBDAD4',
  },
  accountCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: 4,
    ...theme.shadows.surface,
  },
  accountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  accountHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  accountHeaderAction: {
    alignSelf: 'stretch',
  },
  accountHeaderActionDesktop: {
    width: 160,
  },
  accountHeaderActionMobile: {
    width: '100%',
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  name: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
    flexShrink: 1,
  },
  email: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flexShrink: 1,
    maxWidth: '100%',
  },
  noticeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.success,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
  detailStack: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  detailRow: {
    gap: theme.spacing.xxs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  detailLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  detailValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
    maxWidth: '100%',
  },
  editStack: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  formActions: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  contactCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  contactTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  contactDetail: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  footer: {
    gap: theme.spacing.sm,
  },
});
