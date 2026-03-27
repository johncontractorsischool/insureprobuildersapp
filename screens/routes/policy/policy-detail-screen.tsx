import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { SectionHeader } from '@/components/section-header';
import { useIsDesktopWebLayout } from '@/components/web-auth-shell';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePolicies } from '@/context/policies-context';
import { fetchPolicyFilesListByInsuredId } from '@/services/policy-files-api';
import type { PolicyStatus } from '@/types/policy';
import { PolicyFileEntry } from '@/types/policy-file';
import { formatCurrency, formatDate, formatIsoDateTime } from '@/utils/format';

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

function toUserFacingError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to load policy files right now.';
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
  const [policyFiles, setPolicyFiles] = useState<PolicyFileEntry[]>([]);
  const [isLoadingPolicyFiles, setIsLoadingPolicyFiles] = useState(false);
  const [policyFilesError, setPolicyFilesError] = useState<string | null>(null);

  const filteredPolicyFiles = useMemo(() => {
    if (!policy) return [];
    const selectedPolicyId = policy.id.trim();
    const selectedPolicyNumber = policy.policyNumber.trim();

    const filtered = policyFiles.filter((entry) => {
      const entryPolicyId = entry.policyId?.trim() || '';
      const entryPolicyNumber = entry.policyNumber?.trim() || '';

      if (selectedPolicyId && entryPolicyId) {
        return entryPolicyId === selectedPolicyId;
      }

      if (selectedPolicyNumber && entryPolicyNumber) {
        return entryPolicyNumber === selectedPolicyNumber;
      }

      return false;
    });

    return filtered.sort((left, right) => {
      const leftDate = left.changeDate ?? left.createDate ?? '';
      const rightDate = right.changeDate ?? right.createDate ?? '';
      return rightDate.localeCompare(leftDate);
    });
  }, [policy, policyFiles]);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    const hydratePolicyFiles = async () => {
      if (!policy || !policyFilesInsuredId) {
        setPolicyFiles([]);
        setPolicyFilesError(null);
        setIsLoadingPolicyFiles(false);
        return;
      }

      setIsLoadingPolicyFiles(true);
      setPolicyFilesError(null);
      try {
        const response = await fetchPolicyFilesListByInsuredId(policyFilesInsuredId);
        if (!isMounted) return;
        setPolicyFiles(response.data);
      } catch (error) {
        if (!isMounted) return;
        setPolicyFiles([]);
        setPolicyFilesError(toUserFacingError(error));
      } finally {
        if (isMounted) {
          setIsLoadingPolicyFiles(false);
        }
      }
    };

    void hydratePolicyFiles();

    return () => {
      isMounted = false;
    };
  }, [policy, policyFilesInsuredId]);

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
  const lastPaymentDateLabel =
    policy.billing.lastPaymentDate === 'Not billed yet'
      ? policy.billing.lastPaymentDate
      : formatDate(policy.billing.lastPaymentDate);
  const desktopSummaryFacts = [
    {
      label: 'Carrier',
      value: policy.carrierName,
    },
    {
      label: 'Effective',
      value: formatDate(policy.effectiveDate),
    },
    {
      label: 'Renewal',
      value: formatDate(policy.renewalDate),
    },
    {
      label: 'Monthly premium',
      value: formatCurrency(policy.premiumMonthly),
    },
  ] as const;

  const policyFilesContent = isLoadingPolicyFiles ? (
    <View style={styles.filesSkeleton}>
      <View style={[styles.filesSkeletonLine, styles.filesSkeletonWide]} />
      <View style={[styles.filesSkeletonLine, styles.filesSkeletonMid]} />
      <View style={[styles.filesSkeletonLine, styles.filesSkeletonNarrow]} />
    </View>
  ) : filteredPolicyFiles.length > 0 ? (
    filteredPolicyFiles.slice(0, 8).map((entry) => (
      <View key={entry.databaseId} style={styles.fileRow}>
        <View style={styles.fileIconWrap}>
          <Ionicons
            name={entry.fileOrFolder === 'Folder' ? 'folder-open-outline' : 'document-text-outline'}
            size={16}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.fileCopy}>
          <Text style={styles.fileName}>{entry.name}</Text>
          <Text style={styles.fileMeta}>
            {entry.fileOrFolder} • {entry.creatorName ?? 'Unknown'}
          </Text>
          <Text style={styles.fileMeta}>Created: {formatIsoDateTime(entry.createDate)}</Text>
        </View>
      </View>
    ))
  ) : (
    <Text style={styles.lineLabel}>No policy documents are available for this policy yet.</Text>
  );

  const policyFilesAction = (
    <AppButton
      label="Browse policy files"
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
              <Text style={styles.desktopEyebrow}>Policy details</Text>
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
              <SectionHeader title="Documents" subtitle="Policy file folders and files" />
              {policyFilesContent}
              {policyFilesError ? <Text style={styles.fileError}>{policyFilesError}</Text> : null}
              <View style={styles.desktopInlineAction}>{policyFilesAction}</View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Policy overview" subtitle="Coverage and insured details" />
              <View style={styles.desktopOverviewGrid}>
                <View style={styles.desktopOverviewPanel}>
                  <Text style={styles.desktopPanelTitle}>Coverage summary</Text>
                  {policy.coverageSummary.map((coverage) => (
                    <View style={styles.lineItem} key={coverage.label}>
                      <Text style={styles.lineLabel}>{coverage.label}</Text>
                      <Text style={styles.lineValue}>{coverage.value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.desktopOverviewPanel}>
                  <Text style={styles.desktopPanelTitle}>Insured item / person</Text>
                  <View style={styles.desktopStackedField}>
                    <Text style={styles.lineLabel}>Named insured</Text>
                    <Text style={styles.desktopStackValue}>{policy.insuredName}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.desktopStackedField}>
                    <Text style={styles.lineLabel}>Coverage applies to</Text>
                    <Text style={styles.desktopStackValue}>{policy.insuredItem}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.desktopSideColumn}>
            <View style={styles.card}>
              <SectionHeader title="Billing summary" subtitle="Payment plan and due date" />
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
                <Text style={styles.lineValue}>{lastPaymentDateLabel}</Text>
              </View>
              <View
                style={[
                  styles.desktopAutopayBadge,
                  policy.billing.autopayEnabled ? styles.desktopAutopayBadgeOn : null,
                ]}>
                <Text
                  style={[
                    styles.desktopAutopayLabel,
                    policy.billing.autopayEnabled ? styles.desktopAutopayLabelOn : null,
                  ]}>
                  {policy.billing.autopayEnabled ? 'Autopay enabled' : 'Autopay not enabled'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Need help?" subtitle="Secondary desktop actions" />
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

      <SectionHeader title="Documents" subtitle="Policy file folders and files" />
      <View style={styles.card}>
        {policyFilesContent}
        {policyFilesError ? <Text style={styles.fileError}>{policyFilesError}</Text> : null}
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
  desktopAutopayBadge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  desktopAutopayBadgeOn: {
    borderColor: '#C7DEC6',
    backgroundColor: '#EBF9F1',
  },
  desktopAutopayLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  desktopAutopayLabelOn: {
    color: theme.colors.success,
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
