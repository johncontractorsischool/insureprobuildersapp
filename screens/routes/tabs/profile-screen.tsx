import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { buildPbiaFormUrl, createPbiaInstanceId, findPbiaFormBySlug } from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { getNameFromCustomer } from '@/utils/format';
import { openInAppBrowser } from '@/utils/external-actions';

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
  const { customer, userEmail, signOut } = useAuth();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [paperless, setPaperless] = useState(true);

  const handleContactUs = async () => {
    if (Platform.OS !== 'web') {
      const contactForm = findPbiaFormBySlug('contact');
      if (!contactForm) {
        Alert.alert('Form unavailable', 'Please try again.');
        return;
      }

      const formUrl = buildPbiaFormUrl(contactForm, createPbiaInstanceId());
      const result = await openInAppBrowser(formUrl, 'The form link is unavailable right now.');
      if (!result.ok) {
        Alert.alert('Unable to open form', result.message ?? 'Please try again.');
      }
      return;
    }

    router.push({
      pathname: '/forms/[slug]',
      params: { slug: 'contact' },
    });
  };

  const handleLogout = async () => {
    await signOut();
  };

  const accountCard = (
    <View style={[styles.accountCard, isDesktopLayout ? styles.desktopCard : null]}>
      <Text style={styles.label}>Account Holder</Text>
      <Text style={styles.name}>{getNameFromCustomer(customer, userEmail)}</Text>
      <Text style={styles.email}>{customer?.email ?? userEmail ?? 'member@email.com'}</Text>
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
          Reach our team through the Contact Us form and we will follow up shortly.
        </Text>
        <AppButton label="Contact Us" variant="secondary" onPress={() => void handleContactUs()} />
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
