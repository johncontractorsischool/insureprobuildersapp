import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { ContactUsMenu } from '@/components/contact-us-menu';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { persistCustomersForEmail, toCustomerProfile } from '@/services/auth-flow';
import { fetchCustomersByEmail, updateInsuredProfile } from '@/services/customer-api';
import { getPortalConfig } from '@/services/portal-config';
import { sendSmtpEmail } from '@/services/smtp-email-api';
import { Customer, CustomerLookupRecord } from '@/types/customer';
import { getNameFromCustomer } from '@/utils/format';

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function pickPrimaryCustomer(customers: CustomerLookupRecord[], currentCustomer: Customer | null) {
  return (
    customers.find((entry) => entry.databaseId === currentCustomer?.databaseId) ??
    customers.find((entry) => entry.customerId === currentCustomer?.customerId) ??
    customers.find((entry) => entry.active) ??
    customers[0]
  );
}

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
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    email: customer?.email ?? userEmail ?? '',
    phone: customer?.phone ?? '',
    cellPhone: customer?.cellPhone ?? '',
  };
}

function buildMergedCustomerProfile(
  existingCustomer: Customer | null,
  formState: ProfileFormState,
  fallbackEmail: string | null
): Customer {
  const firstName = formState.firstName.trim() || null;
  const lastName = formState.lastName.trim() || null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    ...(existingCustomer ?? {}),
    firstName,
    lastName,
    fullName: fullName || existingCustomer?.commercialName || null,
    email: normalizeEmail(formState.email || fallbackEmail || ''),
    phone: formState.phone.trim() || null,
    cellPhone: formState.cellPhone.trim() || null,
  };
}

function normalizeProfileFieldValue(field: keyof ProfileFormState, value: string) {
  if (field === 'email') {
    return normalizeEmail(value);
  }

  return value.trim();
}

function formatProfileFieldValue(value: string) {
  return value || 'Blank';
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
    phone: 'Phone Number',
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
        previousValue: formatProfileFieldValue(previousValue),
        nextValue: formatProfileFieldValue(nextValue),
      };
    })
    .filter((value): value is ProfileFieldChange => Boolean(value));
}

function buildProfileUpdateEmailBody(
  existingCustomer: Customer | null,
  userEmail: string | null,
  changes: ProfileFieldChange[]
) {
  const escapeHtml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const fieldRows = changes
    .map(
      (change) => `
        <tr>
          <td style="padding:8px;border:1px solid #d7ddda;font-weight:600;">${escapeHtml(change.label)}</td>
          <td style="padding:8px;border:1px solid #d7ddda;">${escapeHtml(change.previousValue)}</td>
          <td style="padding:8px;border:1px solid #d7ddda;">${escapeHtml(change.nextValue)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.5;">
      <p>A profile update was submitted in the Insure Pro Builders app.</p>
      <p><strong>Account Holder:</strong> ${escapeHtml(getNameFromCustomer(existingCustomer, userEmail))}</p>
      <p><strong>Business Name:</strong> ${escapeHtml(existingCustomer?.commercialName?.trim() || 'Blank')}</p>
      <p><strong>Login Email:</strong> ${escapeHtml(userEmail?.trim() || existingCustomer?.email?.trim() || 'Blank')}</p>
      <p><strong>Database ID:</strong> ${escapeHtml(existingCustomer?.databaseId?.trim() || 'Blank')}</p>
      <p><strong>Insured ID:</strong> ${escapeHtml(existingCustomer?.insuredId?.trim() || 'Blank')}</p>
      <table style="border-collapse:collapse;width:100%;margin-top:16px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #d7ddda;text-align:left;background:#f4f7f5;">Field</th>
            <th style="padding:8px;border:1px solid #d7ddda;text-align:left;background:#f4f7f5;">Previous</th>
            <th style="padding:8px;border:1px solid #d7ddda;text-align:left;background:#f4f7f5;">New</th>
          </tr>
        </thead>
        <tbody>${fieldRows}</tbody>
      </table>
    </div>
  `.trim();
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function PreferenceRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        <Text style={styles.preferenceDetail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#D5DDD9', true: '#8ED5B1' }}
        thumbColor={value ? theme.colors.primary : '#FFFFFF'}
      />
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
  const { customer, userEmail, setCustomer, signOut } = useAuth();
  const supportEmail = getPortalConfig().actions.supportEmail;
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [paperless, setPaperless] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [formState, setFormState] = useState<ProfileFormState>(() => buildFormState(customer, userEmail));

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

    if (isSavingProfile) return;

    setIsSavingProfile(true);
    setProfileError('');
    setProfileNotice('');

    try {
      await updateInsuredProfile({
        databaseId: customer?.databaseId,
        type: customer?.type ?? 0,
        commercialName: customer?.commercialName,
        firstName: formState.firstName,
        lastName: formState.lastName,
        email: normalizedEmail,
        phone: formState.phone,
        cellPhone: formState.cellPhone,
      });

      const cacheEmail = normalizeEmail(userEmail ?? customer?.email ?? normalizedEmail);
      const lookupEmails = Array.from(
        new Set(
          [normalizedEmail, customer?.email ? normalizeEmail(customer.email) : null, cacheEmail].filter(
            (value): value is string => Boolean(value)
          )
        )
      );

      let refreshedCustomer: Customer | null = null;
      let supportNotificationSent = true;

      if (profileChanges.length > 0) {
        try {
          await sendSmtpEmail({
            subject: 'Profile Update Notification',
            html: buildProfileUpdateEmailBody(customer, userEmail, profileChanges),
            to: [supportEmail],
          });
        } catch {
          supportNotificationSent = false;
        }
      }

      for (const lookupEmail of lookupEmails) {
        try {
          const customers = await fetchCustomersByEmail(lookupEmail);
          if (customers.length === 0) continue;

          const primaryCustomer = pickPrimaryCustomer(customers, customer);
          refreshedCustomer = toCustomerProfile(primaryCustomer);

          try {
            await persistCustomersForEmail(cacheEmail, customers);
          } catch {
            // Keep the refreshed in-memory user even if cache persistence fails.
          }

          break;
        } catch {
          // Try the next lookup email before falling back to local state.
        }
      }

      if (refreshedCustomer) {
        setCustomer(refreshedCustomer);
        setProfileNotice(
          supportNotificationSent
            ? 'Profile updated successfully.'
            : 'Profile updated successfully. Unable to send the support notification right now.'
        );
      } else {
        setCustomer(buildMergedCustomerProfile(customer, formState, userEmail));
        setProfileNotice(
          supportNotificationSent
            ? 'Profile updated, but the refreshed account data is still catching up.'
            : 'Profile updated, but the refreshed account data is still catching up. Unable to send the support notification right now.'
        );
      }

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
          <Text style={styles.name}>{getNameFromCustomer(customer, userEmail)}</Text>
          <Text style={styles.email}>{customer?.email ?? userEmail ?? 'member@email.com'}</Text>
        </View>
        {!isEditingProfile ? (
          <View style={styles.accountHeaderAction}>
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
            label="Phone Number"
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
            <AppButton label="Save Profile" onPress={handleSaveProfile} loading={isSavingProfile} />
            <AppButton label="Cancel" variant="ghost" onPress={handleCancelEdit} />
          </View>
        </View>
      ) : (
        <View style={styles.detailStack}>
          <DetailRow label="First Name" value={customer?.firstName?.trim() || 'Not provided'} />
          <DetailRow label="Last Name" value={customer?.lastName?.trim() || 'Not provided'} />
          <DetailRow label="Email Address" value={customer?.email?.trim() || userEmail || 'Not provided'} />
          <DetailRow label="Phone Number" value={customer?.phone?.trim() || 'Not provided'} />
          <DetailRow label="Mobile Phone" value={customer?.cellPhone?.trim() || 'Not provided'} />
        </View>
      )}
    </View>
  );

  const preferencesBlock = (
    <View style={styles.preferencesBlock}>
      <SectionHeader title="Contact preferences" subtitle="How we communicate policy updates" />

      <View style={[styles.preferencesCard, isDesktopLayout ? styles.desktopCard : null]}>
        <PreferenceRow
          label="Email notifications"
          detail="Billing reminders and policy notices"
          value={emailAlerts}
          onChange={setEmailAlerts}
        />
        <PreferenceRow
          label="SMS alerts"
          detail="Urgent renewal and payment alerts"
          value={smsAlerts}
          onChange={setSmsAlerts}
        />
        <PreferenceRow
          label="Paperless documents"
          detail="Receive policy documents digitally"
          value={paperless}
          onChange={setPaperless}
        />
      </View>
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
        // Desktop keeps profile preferences in a readable primary column with account actions in a calm right rail.
        <View style={styles.desktopLayout}>
          <View style={styles.desktopMainColumn}>
            {accountCard}
            {preferencesBlock}
          </View>
          <View style={styles.desktopSideColumn}>{supportBlock}</View>
        </View>
      ) : (
        <>
          {accountCard}
          {preferencesBlock}
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
  },
  accountHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  accountHeaderAction: {
    width: 160,
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
  },
  email: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  detailLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flex: 1,
  },
  detailValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'right',
  },
  editStack: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  formActions: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  preferencesBlock: {
    gap: theme.spacing.sm,
  },
  preferencesCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.surface,
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
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  preferenceCopy: {
    flex: 1,
    gap: 2,
  },
  preferenceLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  preferenceDetail: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  footer: {
    gap: theme.spacing.sm,
  },
});
