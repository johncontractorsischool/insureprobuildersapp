import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { mockPolicies } from '@/data/mock-policies';
import { formatCurrency, formatDate } from '@/utils/format';

export default function PolicyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const policy = mockPolicies.find((item) => item.id === id);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated]);

  if (!policy) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="warning-outline"
          title="Policy not found"
          description="The selected policy could not be located in mock data."
          actionLabel="Back to policies"
          onAction={() => router.replace('/(tabs)/policies')}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.product}>{policy.productName}</Text>
        <Text style={styles.policyNumber}>Policy {policy.policyNumber}</Text>
        <Text style={styles.status}>{policy.status}</Text>
      </View>

      <SectionHeader title="Coverage summary" />
      <View style={styles.card}>
        {policy.coverageSummary.map((coverage) => (
          <View style={styles.lineItem} key={coverage.label}>
            <Text style={styles.lineLabel}>{coverage.label}</Text>
            <Text style={styles.lineValue}>{coverage.value}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Insured item / person" />
      <View style={styles.card}>
        <Text style={styles.lineLabel}>Named insured</Text>
        <Text style={styles.lineValue}>{policy.insuredName}</Text>
        <View style={styles.divider} />
        <Text style={styles.lineLabel}>Coverage applies to</Text>
        <Text style={styles.lineValue}>{policy.insuredItem}</Text>
      </View>

      <SectionHeader title="Billing summary" />
      <View style={styles.card}>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Plan</Text>
          <Text style={styles.lineValue}>{policy.billing.plan}</Text>
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Monthly premium</Text>
          <Text style={styles.lineValue}>{formatCurrency(policy.billing.monthlyPremium)}</Text>
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Next due date</Text>
          <Text style={styles.lineValue}>{formatDate(policy.billing.nextDueDate)}</Text>
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Last payment</Text>
          <Text style={styles.lineValue}>
            {policy.billing.lastPaymentDate === 'Not billed yet'
              ? policy.billing.lastPaymentDate
              : formatDate(policy.billing.lastPaymentDate)}
          </Text>
        </View>
      </View>

      <SectionHeader title="Documents" subtitle="Placeholder for future document APIs" />
      <View style={styles.card}>
        {policy.documents.map((document) => (
          <View key={document.id} style={styles.lineItem}>
            <Text style={styles.lineValue}>{document.name}</Text>
            <Text style={styles.lineLabel}>Updated {formatDate(document.updatedAt)}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Claims" subtitle="Placeholder for claims integration" />
      <View style={styles.card}>
        <Text style={styles.lineValue}>{policy.claimsPlaceholder}</Text>
        <View style={styles.claimButton}>
          <AppButton label="Start claim (coming soon)" variant="secondary" onPress={() => {}} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    width: '100%',
    maxWidth: theme.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: theme.layout.screenHorizontal,
    paddingTop: theme.spacing.lg,
    paddingBottom: 32,
    gap: theme.spacing.md,
  },
  hero: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: 6,
    ...theme.shadows.surface,
  },
  product: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  policyNumber: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  status: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginTop: 2,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  lineLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flex: 1,
  },
  lineValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  claimButton: {
    marginTop: theme.spacing.sm,
  },
  emptyWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    paddingHorizontal: theme.layout.screenHorizontal,
  },
});
