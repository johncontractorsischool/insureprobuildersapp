import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { PolicyCard } from '@/components/policy-card';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { SummaryCard } from '@/components/summary-card';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { mockPolicies } from '@/data/mock-policies';
import { formatCurrency, formatDate, getNameFromEmail } from '@/utils/format';

const quickActions = [
  { id: 'claims', title: 'Start a claim', icon: 'document-text-outline' as const },
  { id: 'idcard', title: 'Digital ID cards', icon: 'card-outline' as const },
  { id: 'billing', title: 'Billing settings', icon: 'wallet-outline' as const },
];

export default function DashboardScreen() {
  const { userEmail } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const activePolicies = useMemo(
    () => mockPolicies.filter((policy) => policy.status === 'Active'),
    []
  );
  const monthlyTotal = useMemo(
    () => activePolicies.reduce((sum, policy) => sum + policy.premiumMonthly, 0),
    [activePolicies]
  );
  const nextRenewal = useMemo(() => {
    const sorted = [...activePolicies].sort((a, b) =>
      a.renewalDate.localeCompare(b.renewalDate)
    );
    return sorted[0];
  }, [activePolicies]);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Welcome back</Text>
          <Text style={styles.name}>{getNameFromEmail(userEmail)}</Text>
        </View>
        <BrandMark size={46} withWordmark={false} />
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Active policies" value={`${activePolicies.length}`} highlight="green" />
        <SummaryCard label="Monthly total" value={formatCurrency(monthlyTotal)} highlight="neutral" />
      </View>
      <SummaryCard
        label="Next renewal"
        value={nextRenewal ? `${nextRenewal.productName}  ${formatDate(nextRenewal.renewalDate)}` : 'N/A'}
        highlight="red"
      />

      <SectionHeader
        title="Active policies"
        subtitle="Core protections currently in force"
        actionLabel="View all"
        onActionPress={() => router.push('/(tabs)/policies')}
      />

      {activePolicies.length > 0 ? (
        activePolicies.slice(0, 2).map((policy) => (
          <PolicyCard
            key={policy.id}
            policy={policy}
            onPress={() =>
              router.push({
                pathname: '/policy/[id]',
                params: { id: policy.id },
              })
            }
          />
        ))
      ) : (
        <EmptyState
          title="No active policies yet"
          description="Once policies are activated, they will appear here for quick access."
        />
      )}

      <SectionHeader
        title="Quick actions"
        subtitle="Frequently used self-service tools"
      />
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <Pressable key={action.id} style={styles.quickCard}>
            <Ionicons name={action.icon} size={20} color={theme.colors.primary} />
            <Text style={styles.quickTitle}>{action.title}</Text>
            <Text style={styles.quickMeta}>Coming soon</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>API integration placeholder</Text>
        <Text style={styles.placeholderCopy}>
          Dashboard metrics are using mock policy data. Live policy, claims, and billing APIs can be
          connected without changing this layout layer.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCopy: {
    gap: 4,
  },
  eyebrow: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  name: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickCard: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 110,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
    ...theme.shadows.surface,
  },
  quickTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  quickMeta: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    marginTop: 'auto',
  },
  placeholder: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.md,
    marginTop: theme.spacing.xs,
    gap: 6,
  },
  placeholderTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  placeholderCopy: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
});
