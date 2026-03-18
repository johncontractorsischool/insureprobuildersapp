import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandMark } from '@/components/brand-mark';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function LandingScreen() {
  const { isAuthenticated } = useAuth();

  return (
    <ScreenContainer scroll={false} backgroundTone="soft">
      <View style={styles.top}>
        <BrandMark />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Trusted Coverage. Premium Service.</Text>
        <Text style={styles.title}>Insurance built for clarity, confidence, and control.</Text>
        <Text style={styles.subtitle}>
          Securely access policy details, billing, and service tools in one executive-grade portal.
        </Text>
        <View style={styles.trustPills}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Enterprise security</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Fast policy access</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>24/7 account support</Text>
          </View>
        </View>
      </View>

      <View style={styles.cta}>
        <AppButton
          label={isAuthenticated ? 'Enter Your Dashboard' : 'Secure Login'}
          onPress={() => router.replace(isAuthenticated ? '/(tabs)' : '/(auth)/login')}
        />
        <Text style={styles.caption}>One-time verification is used for account protection.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: theme.spacing.sm,
  },
  heroCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
    ...theme.shadows.elevated,
  },
  eyebrow: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.textStrong,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  trustPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  pill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 7,
    backgroundColor: '#ECF8F1',
    borderWidth: 1,
    borderColor: '#D6EBDC',
  },
  pillText: {
    ...theme.typography.caption,
    color: theme.colors.primaryDeep,
  },
  cta: {
    marginTop: 'auto',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  caption: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    textAlign: 'center',
  },
});
