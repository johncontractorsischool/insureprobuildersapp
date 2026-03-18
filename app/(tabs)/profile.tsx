import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandMark } from '@/components/brand-mark';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { getNameFromEmail } from '@/utils/format';

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

export default function ProfileScreen() {
  const { userEmail, signOut } = useAuth();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [paperless, setPaperless] = useState(true);

  const handleLogout = () => {
    signOut();
    router.replace('/');
  };

  return (
    <ScreenContainer>
      <View style={styles.top}>
        <BrandMark />
      </View>

      <View style={styles.accountCard}>
        <Text style={styles.label}>Account holder</Text>
        <Text style={styles.name}>{getNameFromEmail(userEmail)}</Text>
        <Text style={styles.email}>{userEmail ?? 'member@email.com'}</Text>
      </View>

      <SectionHeader title="Contact preferences" subtitle="How we communicate policy updates" />

      <View style={styles.preferencesCard}>
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

      <View style={styles.footer}>
        <Text style={styles.footerCopy}>
          Preference toggles are saved locally in this front-end skeleton.
        </Text>
        <AppButton label="Log out" variant="danger" onPress={handleLogout} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: theme.spacing.sm,
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
  preferencesCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.surface,
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
    marginTop: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  footerCopy: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
