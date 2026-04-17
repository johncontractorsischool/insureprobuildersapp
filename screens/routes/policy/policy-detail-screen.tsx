import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { SectionHeader } from '@/components/section-header';
import { useIsDesktopWebLayout } from '@/components/web-auth-shell';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePolicies } from '@/context/policies-context';
import { fetchPolicyCoveragesByPolicyId, type PolicyCoverageGroup } from '@/services/policy-coverages-api';
import type { PolicyStatus } from '@/types/policy';
import { formatCurrency, formatDate } from '@/utils/format';

const DESKTOP_POLICY_MAX_CONTENT_WIDTH = 1260;

const POLICY_STATUS_BADGE_STYLES: Record<
  PolicyStatus,
  {
    backgroundColor: string;
    textColor: string;
  }
> = {
  Active: {
    backgroundColor: '#EBF9F1',
    textColor: theme.colors.success,
  },
  Pending: {
    backgroundColor: '#FFF4E4',
    textColor: '#9B6300',
  },
  Lapsed: {
    backgroundColor: theme.colors.dangerSoft,
    textColor: theme.colors.danger,
  },
};

function toPolicyCoveragesError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to load policy coverage details right now.';
}

type PolicyDetailScreenProps = {
  showInContentBackButton?: boolean;
};

export default function PolicyDetailScreen({
  showInContentBackButton = false,
}: PolicyDetailScreenProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDesktopLayout = useIsDesktopWebLayout();
  const isDesktopWebLayout = Platform.OS === 'web' && isDesktopLayout;
  const { isAuthenticated, customer } = useAuth();
  const { policies, isLoadingPolicies, policiesError, refreshPolicies } = usePolicies();
  const policy = policies.find((item) => item.id === id);
  const policyFilesInsuredId = customer?.databaseId?.trim() || customer?.insuredId?.trim() || '';
  const [coverageGroups, setCoverageGroups] = useState<PolicyCoverageGroup[]>([]);
  const [isLoadingPolicyCoverages, setIsLoadingPolicyCoverages] = useState(false);
  const [policyCoveragesError, setPolicyCoveragesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    const hydratePolicyCoverages = async () => {
      if (!policy) {
        setCoverageGroups([]);
        setPolicyCoveragesError(null);
        setIsLoadingPolicyCoverages(false);
        return;
      }

      setIsLoadingPolicyCoverages(true);
      setPolicyCoveragesError(null);
      try {
        const nextCoverageGroups = await fetchPolicyCoveragesByPolicyId(policy.id);
        if (!isMounted) return;
        setCoverageGroups(nextCoverageGroups);
      } catch (error) {
        if (!isMounted) return;
        setCoverageGroups([]);
        setPolicyCoveragesError(toPolicyCoveragesError(error));
      } finally {
        if (isMounted) {
          setIsLoadingPolicyCoverages(false);
        }
      }
    };

    void hydratePolicyCoverages();

    return () => {
      isMounted = false;
    };
  }, [policy]);

  if (isLoadingPolicies) {
    return (
      <View style={styles.emptyWrap}>
        <LoadingState />
      </View>
    );
  }

  if (policiesError) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="warning-outline"
          title="Unable to load policy"
          description={policiesError}
          actionLabel="Retry"
          onAction={() => {
            void refreshPolicies();
          }}
        />
      </View>
    );
  }

  if (!policy) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="warning-outline"
          title="Policy not found"
          description="The selected policy could not be located for this profile."
          actionLabel="Back to policies"
          onAction={() => router.replace('/(tabs)/policies')}
        />
      </View>
    );
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/policies');
  };
  const statusBadge = POLICY_STATUS_BADGE_STYLES[policy.status];
  const desktopSummaryFacts = [
    {
      label: 'Carrier',
      value: policy.carrierName,
    },
    {
      label: 'Effective Date',
      value: formatDate(policy.effectiveDate),
    },
    {
      label: 'Expiration Date',
      value: formatDate(policy.expirationDate),
    },
    {
      label: 'Monthly Premium',
      value: formatCurrency(policy.premiumMonthly),
    },
  ] as const;
  const policyDateRows = [
    {
      label: 'Effective Date',
      value: formatDate(policy.effectiveDate),
    },
    {
      label: 'Expiration Date',
      value: formatDate(policy.expirationDate),
    },
  ] as const;
  const coverageDetailsBody = (
    <>
      {isLoadingPolicyCoverages ? <Text style={styles.sectionNote}>Loading Coverage Details...</Text> : null}
      {policyCoveragesError ? <Text style={[styles.sectionNote, styles.sectionError]}>{policyCoveragesError}</Text> : null}

      {coverageGroups.length > 0 ? (
        <View style={styles.coverageGroupGrid}>
          {coverageGroups.map((group) => (
            <View key={group.id} style={styles.coverageGroupCard}>
              <Text style={styles.coverageGroupTitle}>{group.title}</Text>
              {group.rows.map((row) => (
                <View key={`${group.id}-${row.label}`} style={styles.lineItem}>
                  <Text style={styles.lineLabel}>{row.label}</Text>
                  <Text style={styles.lineValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : policy.coverageSummary.length > 0 ? (
        <View style={styles.coverageGroupGrid}>
          <View style={styles.coverageGroupCard}>
            <Text style={styles.coverageGroupTitle}>Coverage Summary</Text>
            {policy.coverageSummary.map((coverage) => (
              <View style={styles.lineItem} key={coverage.label}>
                <Text style={styles.lineLabel}>{coverage.label}</Text>
                <Text style={styles.lineValue}>{coverage.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : !isLoadingPolicyCoverages ? (
        <Text style={styles.sectionNote}>Coverage Details are not available for this policy yet.</Text>
      ) : null}
    </>
  );

  const policyFilesAction = (
    <AppButton
      label="Browse Policy Files"
      variant="secondary"
      onPress={() => {
        router.push({
          pathname: '/policy-files',
          params: {
            insuredId: policyFilesInsuredId,
            policyId: policy.id,
            policyNumber: policy.policyNumber,
          },
        });
      }}
      disabled={!policyFilesInsuredId}
    />
  );

  if (isDesktopWebLayout) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, styles.desktopContent]}>
        <View style={styles.desktopHero}>
          {showInContentBackButton ? (
            <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button">
              <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : null}

          <View style={styles.desktopHeroTop}>
            <View style={styles.desktopHeroCopy}>
              <Text style={styles.desktopEyebrow}>Policy Details</Text>
              <Text style={styles.desktopProduct}>{policy.productName}</Text>
              <Text style={styles.desktopPolicyNumber}>Policy {policy.policyNumber}</Text>
            </View>
            <View style={[styles.desktopStatusBadge, { backgroundColor: statusBadge.backgroundColor }]}>
              <Text style={[styles.desktopStatusBadgeText, { color: statusBadge.textColor }]}>
                {policy.status}
              </Text>
            </View>
          </View>

          <View style={styles.desktopSummaryGrid}>
            {desktopSummaryFacts.map((fact) => (
              <View key={fact.label} style={styles.desktopSummaryItem}>
                <Text style={styles.desktopSummaryLabel}>{fact.label}</Text>
                <Text style={styles.desktopSummaryValue}>{fact.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.desktopGrid}>
          <View style={styles.desktopMainColumn}>
            <View style={styles.card}>
              <SectionHeader title="Coverage Details" subtitle="Policy Limits and Coverage Information" />
              {coverageDetailsBody}
            </View>

            <View style={styles.card}>
              <SectionHeader title="Documents" subtitle="Open the policy files screen for available documents." />
              <View style={styles.desktopInlineAction}>{policyFilesAction}</View>
            </View>
          </View>

          <View style={styles.desktopSideColumn}>
            <View style={styles.card}>
              <SectionHeader title="Need Help?" subtitle="Secondary Desktop Actions" />
              <Text style={styles.desktopHelpText}>
                For document requests or policy support, use quick actions or return to your policy list.
              </Text>
              <View style={styles.desktopSideActions}>
                <AppButton
                  label="Back to policies"
                  variant="secondary"
                  onPress={() => {
                    router.replace('/(tabs)/policies');
                  }}
                />
                <AppButton
                  label="Company details"
                  variant="ghost"
                  onPress={() => {
                    router.push('/company');
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.product}>{policy.productName}</Text>
        <Text style={styles.policyNumber}>Policy {policy.policyNumber}</Text>
        <Text style={styles.status}>{policy.status}</Text>
      </View>

      <SectionHeader title="Policy Dates" />
      <View style={styles.card}>
        {policyDateRows.map((row) => (
          <View key={row.label} style={styles.lineItem}>
            <Text style={styles.lineLabel}>{row.label}</Text>
            <Text style={styles.lineValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Coverage Details" />
      <View style={styles.card}>
        {coverageDetailsBody}
      </View>

      <SectionHeader title="Documents" subtitle="Open the policy files screen for available documents." />
      <View style={styles.card}>
        <View style={styles.claimButton}>{policyFilesAction}</View>
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
  desktopContent: {
    maxWidth: DESKTOP_POLICY_MAX_CONTENT_WIDTH,
    gap: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 2,
  },
  backButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  desktopHero: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  desktopHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  desktopHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  desktopEyebrow: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  desktopProduct: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  desktopPolicyNumber: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  desktopStatusBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  desktopStatusBadgeText: {
    ...theme.typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  desktopSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  desktopSummaryItem: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    minWidth: 180,
    flexGrow: 1,
    gap: 4,
  },
  desktopSummaryLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  desktopSummaryValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  desktopMainColumn: {
    flex: 1.7,
    gap: theme.spacing.md,
  },
  desktopSideColumn: {
    flex: 1,
    gap: theme.spacing.md,
  },
  desktopInlineAction: {
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 260,
  },
  coverageGroupGrid: {
    gap: theme.spacing.sm,
  },
  coverageGroupCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  coverageGroupTitle: {
    ...theme.typography.label,
    color: theme.colors.textStrong,
  },
  sectionNote: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  sectionError: {
    color: theme.colors.danger,
  },
  desktopOverviewGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  desktopOverviewPanel: {
    flex: 1,
    minWidth: 0,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  desktopPanelTitle: {
    ...theme.typography.label,
    color: theme.colors.textStrong,
  },
  desktopStackedField: {
    gap: 4,
  },
  desktopStackValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  desktopHelpText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  desktopSideActions: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
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
  filesSkeleton: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  filesSkeletonLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#DCE6E1',
  },
  filesSkeletonWide: {
    width: '85%',
  },
  filesSkeletonMid: {
    width: '72%',
  },
  filesSkeletonNarrow: {
    width: '58%',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.sm,
  },
  fileIconWrap: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileCopy: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  fileMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  fileError: {
    ...theme.typography.caption,
    color: theme.colors.danger,
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
