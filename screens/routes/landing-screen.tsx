import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandMark } from '@/components/brand-mark';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const featurePills = [
  'Instant certificate downloads',
  'CSLB-compliant coverage',
  'Manage payments & renewals',
];

export default function LandingScreen() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoadingAuth]);

  if (isLoadingAuth) {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState title="Restoring session" description="Checking your secure login state..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.top}>
        <BrandMark />
      </View>

      <View style={styles.heroWrap}>
        <View pointerEvents="none" style={styles.heroStructure} />
        <View pointerEvents="none" style={styles.heroBracket} />
        <View pointerEvents="none" style={styles.heroBrace} />

        <View style={styles.heroCard}>
          <View style={styles.heroRule} />
          <Text style={styles.eyebrow}>FAST. RELIABLE. BUILT FOR CONTRACTORS.</Text>
          <Text style={styles.title}>Stay insured. Stay compliant. Get to work.</Text>
          <Text style={styles.subtitle}>
            Access your policies, download certificates, and manage your coverage anytime.
          </Text>

          <View style={styles.trustPills}>
            {featurePills.map((item) => (
              <View key={item} style={styles.pill}>
                <View style={styles.pillMarker} />
                <Text style={styles.pillText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.cta}>
        <AppButton
          label="Access Your Account"
          onPress={() => (isAuthenticated ? router.replace('/(tabs)') : router.push('/(auth)/login'))}
        />
        {!isAuthenticated ? (
          <AppButton
            label="Sign Up"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { mode: 'signup' } })}
          />
        ) : null}
        <Text style={styles.caption}>One-time verification helps protect your account.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: theme.spacing.sm,
  },
  heroWrap: {
    position: 'relative',
    marginTop: theme.spacing.xs,
  },
  heroStructure: {
    position: 'absolute',
    top: 16,
    right: 0,
    left: 0,
    bottom: -10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#D3DFD9',
    backgroundColor: '#F1F6F3',
  },
  heroBracket: {
    position: 'absolute',
    top: 30,
    right: 20,
    width: 88,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C1D4CC',
  },
  heroBrace: {
    position: 'absolute',
    left: 14,
    bottom: 22,
    width: 6,
    height: 84,
    borderRadius: 3,
    backgroundColor: '#C5D7CF',
  },
  heroCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  heroRule: {
    width: 84,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  eyebrow: {
    ...theme.typography.label,
    color: theme.colors.primaryDeep,
    letterSpacing: 0.5,
  },
  title: {
    ...theme.typography.display,
    fontSize: 36,
    lineHeight: 42,
    color: theme.colors.textStrong,
  },
  subtitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  trustPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    backgroundColor: '#EAF3EE',
    borderWidth: 1,
    borderColor: '#C6D8CF',
  },
  pillMarker: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  pillText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primaryDeep,
    fontWeight: '700',
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
