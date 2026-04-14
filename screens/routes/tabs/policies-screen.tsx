import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { PolicyCard } from '@/components/policy-card';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import {
  PbiaFormSlug,
  buildPbiaFormUrl,
  createPbiaInstanceId,
  findPbiaFormBySlug,
} from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';
import { usePolicies } from '@/context/policies-context';
import { Policy } from '@/types/policy';
import { openInAppBrowser } from '@/utils/external-actions';
import { formatCurrency } from '@/utils/format';

type CoverageSectionKey = 'workers-comp' | 'clb-bond' | 'general-liability' | 'commercial-auto';

type CoverageSectionConfig = {
  key: CoverageSectionKey;
  title: string;
  formSlug: PbiaFormSlug;
  keywords: readonly string[];
  quoteDescription: string;
};

type CoverageSectionModel = CoverageSectionConfig & {
  matchedPolicies: Policy[];
  isOwned: boolean;
};

type DesktopSummary = {
  totalPolicies: number;
  activeCount: number;
  pendingCount: number;
  lapsedCount: number;
  totalMonthlyPremium: number;
  coveredLineCount: number;
  missingLineCount: number;
};

const COVERAGE_SECTIONS: readonly CoverageSectionConfig[] = [
  {
    key: 'workers-comp',
    title: 'Workers Compensation',
    formSlug: 'workers-comp',
    keywords: ['workers compensation', 'workers comp', 'worker compensation', 'worker comp'],
    quoteDescription: 'Request a quote for workers compensation insurance.',
  },
  {
    key: 'clb-bond',
    title: 'CLB Bond',
    formSlug: 'bond-quote',
    keywords: ['bond', 'contractor bond', 'license bond', 'surety bond', 'cslb bond', 'clb bond'],
    quoteDescription: 'Request a quote for contractor bond coverage.',
  },
  {
    key: 'general-liability',
    title: 'General Liability',
    formSlug: 'general-liability',
    keywords: ['general liability', 'general liab', 'cgl'],
    quoteDescription: 'Request a quote for general liability insurance.',
  },
  {
    key: 'commercial-auto',
    title: 'Commercial Auto',
    formSlug: 'commercial-auto',
    keywords: ['commercial auto', 'commercial automobile', 'business auto', 'auto liability'],
    quoteDescription: 'Request a quote for commercial auto insurance.',
  },
] as const;

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPolicyMatchText(policy: Policy) {
  const coverageSummaryValues = policy.coverageSummary.map((item) => item.value).join(' ');
  return normalizeForMatch([policy.productName, policy.insuredItem, coverageSummaryValues].join(' '));
}

type PoliciesScreenProps = {
  includeTabBarPadding?: boolean;
  isDesktopLayout?: boolean;
};

type PoliciesSkeletonProps = {
  includeTabBarPadding: boolean;
  bottomInset: number;
  isDesktopLayout: boolean;
};

function PoliciesSkeleton({
  includeTabBarPadding,
  bottomInset,
  isDesktopLayout,
}: PoliciesSkeletonProps) {
  const contentPadding = { paddingBottom: bottomInset + (includeTabBarPadding ? 116 : 24) };

  if (isDesktopLayout) {
    return (
      <ScreenContainer contentContainerStyle={[styles.desktopScreenContent, contentPadding]}>
        <View style={styles.skeletonHeader}>
          <View style={[styles.skeletonBlock, styles.skeletonHeaderTitle]} />
        </View>

        <View style={styles.desktopLayout}>
          <View style={styles.desktopMainColumn}>
            {[0, 1].map((index) => (
              <View key={`owned-desktop-${index}`} style={styles.desktopSectionPanel}>
                <View style={[styles.skeletonBlock, styles.skeletonSectionTitle]} />
                <View style={styles.skeletonPolicyCard}>
                  <View style={styles.skeletonPolicyTopRow}>
                    <View style={[styles.skeletonBlock, styles.skeletonCarrier]} />
                    <View style={styles.skeletonStatusBadge} />
                  </View>
                  <View style={[styles.skeletonBlock, styles.skeletonPolicyNumber]} />
                  <View style={styles.skeletonMetricsRow}>
                    <View style={styles.skeletonMetricColumn}>
                      <View style={[styles.skeletonBlock, styles.skeletonMetricLabel]} />
                      <View style={[styles.skeletonBlock, styles.skeletonMetricValue]} />
                    </View>
                    <View style={styles.skeletonMetricColumn}>
                      <View style={[styles.skeletonBlock, styles.skeletonMetricLabel]} />
                      <View style={[styles.skeletonBlock, styles.skeletonMetricValue]} />
                    </View>
                  </View>
                  <View style={[styles.skeletonBlock, styles.skeletonCardFooter]} />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.desktopSideColumn}>
            {[0, 1, 2].map((index) => (
              <View key={`rail-${index}`} style={styles.skeletonRailCard}>
                <View style={[styles.skeletonBlock, styles.skeletonRailTitle]} />
                <View style={[styles.skeletonBlock, styles.skeletonRailLineWide]} />
                <View style={[styles.skeletonBlock, styles.skeletonRailLineMedium]} />
                <View style={[styles.skeletonBlock, styles.skeletonRailLineNarrow]} />
              </View>
            ))}
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={contentPadding}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonBlock, styles.skeletonHeaderTitle]} />
      </View>

      {[0, 1].map((index) => (
        <View key={`owned-${index}`} style={styles.sectionBlock}>
          <View style={[styles.skeletonBlock, styles.skeletonSectionTitle]} />
          <View style={styles.skeletonPolicyCard}>
            <View style={styles.skeletonPolicyTopRow}>
              <View style={[styles.skeletonBlock, styles.skeletonCarrier]} />
              <View style={styles.skeletonStatusBadge} />
            </View>
            <View style={[styles.skeletonBlock, styles.skeletonPolicyNumber]} />
            <View style={styles.skeletonMetricsRow}>
              <View style={styles.skeletonMetricColumn}>
                <View style={[styles.skeletonBlock, styles.skeletonMetricLabel]} />
                <View style={[styles.skeletonBlock, styles.skeletonMetricValue]} />
              </View>
              <View style={styles.skeletonMetricColumn}>
                <View style={[styles.skeletonBlock, styles.skeletonMetricLabel]} />
                <View style={[styles.skeletonBlock, styles.skeletonMetricValue]} />
              </View>
            </View>
            <View style={[styles.skeletonBlock, styles.skeletonCardFooter]} />
          </View>
        </View>
      ))}

      {[0, 1].map((index) => (
        <View key={`missing-${index}`} style={styles.sectionBlock}>
          <View style={[styles.skeletonBlock, styles.skeletonSectionTitle]} />
          <View style={styles.skeletonQuoteCard}>
            <View style={[styles.skeletonBlock, styles.skeletonQuoteTitle]} />
            <View style={[styles.skeletonBlock, styles.skeletonQuoteLineWide]} />
            <View style={[styles.skeletonBlock, styles.skeletonQuoteLineMedium]} />
            <View style={styles.skeletonQuoteButton} />
          </View>
        </View>
      ))}
    </ScreenContainer>
  );
}

export default function PoliciesScreen({
  includeTabBarPadding = true,
  isDesktopLayout = false,
}: PoliciesScreenProps) {
  const insets = useSafeAreaInsets();
  const { policies, isLoadingPolicies, policiesError, refreshPolicies } = usePolicies();

  const coverageSections = useMemo<CoverageSectionModel[]>(() => {
    const policiesWithMatchText = policies.map((policy) => ({
      policy,
      matchText: buildPolicyMatchText(policy),
    }));

    return COVERAGE_SECTIONS.map((section) => {
      const normalizedKeywords = section.keywords.map((keyword) => normalizeForMatch(keyword));
      const matchedPolicies = policiesWithMatchText
        .filter(({ matchText }) => normalizedKeywords.some((keyword) => matchText.includes(keyword)))
        .map(({ policy }) => policy);

      return {
        ...section,
        matchedPolicies,
        isOwned: matchedPolicies.length > 0,
      };
    });
  }, [policies]);

  const ownedSections = useMemo(
    () => coverageSections.filter((section) => section.isOwned),
    [coverageSections]
  );
  const missingSections = useMemo(
    () => coverageSections.filter((section) => !section.isOwned),
    [coverageSections]
  );

  const desktopSummary = useMemo<DesktopSummary>(() => {
    let activeCount = 0;
    let pendingCount = 0;
    let lapsedCount = 0;
    let totalMonthlyPremium = 0;

    for (const policy of policies) {
      if (policy.status === 'Active') activeCount += 1;
      if (policy.status === 'Pending') pendingCount += 1;
      if (policy.status === 'Lapsed') lapsedCount += 1;
      totalMonthlyPremium += policy.premiumMonthly;
    }

    return {
      totalPolicies: policies.length,
      activeCount,
      pendingCount,
      lapsedCount,
      totalMonthlyPremium,
      coveredLineCount: ownedSections.length,
      missingLineCount: missingSections.length,
    };
  }, [missingSections.length, ownedSections.length, policies]);

  const handlePolicyPress = (policyId: string) => {
    router.push({
      pathname: '/policy/[id]',
      params: { id: policyId },
    });
  };

  const handleQuotePress = async (slug: PbiaFormSlug) => {
    if (Platform.OS !== 'web') {
      const form = findPbiaFormBySlug(slug);
      if (!form) {
        Alert.alert('Form unavailable', 'Please try again.');
        return;
      }

      const formUrl = buildPbiaFormUrl(form, createPbiaInstanceId());
      const result = await openInAppBrowser(formUrl, 'The form link is unavailable right now.');
      if (!result.ok) {
        Alert.alert('Unable to open form', result.message ?? 'Please try again.');
      }
      return;
    }

    router.push({
      pathname: '/forms/[slug]',
      params: { slug },
    });
  };

  const renderOwnedSection = (section: CoverageSectionModel) => {
    return (
      <View
        key={section.key}
        style={[styles.sectionBlock, isDesktopLayout ? styles.desktopSectionPanel : null]}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionContent}>
          {section.matchedPolicies.map((policy) => (
            <PolicyCard
              key={`${section.key}-${policy.id}`}
              policy={policy}
              onPress={() => handlePolicyPress(policy.id)}
              onRequestQuote={
                policy.status === 'Lapsed'
                  ? () => {
                      void handleQuotePress(section.formSlug);
                    }
                  : undefined
              }
            />
          ))}
        </View>
      </View>
    );
  };

  const renderMissingSection = (section: CoverageSectionModel) => {
    return (
      <View
        key={section.key}
        style={[styles.sectionBlock, isDesktopLayout ? styles.desktopSectionPanel : null]}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.quoteCard}>
          <Text style={styles.quoteCardTitle}>No Policy on File</Text>
          <Text style={styles.quoteCardDescription}>{section.quoteDescription}</Text>
          <Pressable
            onPress={() => void handleQuotePress(section.formSlug)}
            style={({ pressed }) => [styles.quoteButton, pressed ? styles.quoteButtonPressed : null]}>
            <Text style={styles.quoteButtonText}>Request a Quote</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (isLoadingPolicies) {
    return (
      <PoliciesSkeleton
        includeTabBarPadding={includeTabBarPadding}
        bottomInset={insets.bottom}
        isDesktopLayout={isDesktopLayout}
      />
    );
  }

  if (policiesError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="warning-outline"
          title="Unable to load policies"
          description={policiesError}
          actionLabel="Retry"
          onAction={() => {
            void refreshPolicies();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      contentContainerStyle={[
        { paddingBottom: insets.bottom + (includeTabBarPadding ? 116 : 24) },
        isDesktopLayout ? styles.desktopScreenContent : null,
      ]}>
      <SectionHeader title="Policies" />

      {isDesktopLayout ? (
        // Desktop uses a stable split shell so policies stay readable while summary/actions are always visible.
        <View style={styles.desktopLayout}>
          <View style={styles.desktopMainColumn}>
            {ownedSections.map(renderOwnedSection)}
            {missingSections.map(renderMissingSection)}
          </View>

          <View style={styles.desktopSideColumn}>
            <View style={styles.desktopRailCard}>
              <Text style={styles.desktopRailTitle}>Coverage Summary</Text>
              <View style={styles.desktopSummaryGrid}>
                <View style={styles.desktopSummaryItem}>
                  <Text style={styles.desktopSummaryLabel}>Policies on file</Text>
                  <Text style={styles.desktopSummaryValue}>{desktopSummary.totalPolicies}</Text>
                </View>
                <View style={styles.desktopSummaryItem}>
                  <Text style={styles.desktopSummaryLabel}>Monthly premium</Text>
                  <Text style={styles.desktopSummaryValue}>
                    {formatCurrency(desktopSummary.totalMonthlyPremium)}
                  </Text>
                </View>
                <View style={styles.desktopSummaryItem}>
                  <Text style={styles.desktopSummaryLabel}>Covered lines</Text>
                  <Text style={styles.desktopSummaryValue}>{desktopSummary.coveredLineCount}</Text>
                </View>
                <View style={styles.desktopSummaryItem}>
                  <Text style={styles.desktopSummaryLabel}>Lines to quote</Text>
                  <Text style={styles.desktopSummaryValue}>{desktopSummary.missingLineCount}</Text>
                </View>
              </View>
            </View>

            <View style={styles.desktopRailCard}>
              <Text style={styles.desktopRailTitle}>Coverage Status</Text>
              <View style={styles.desktopStatusList}>
                {coverageSections.map((section) => {
                  const isOwned = section.isOwned;
                  return (
                    <View key={`status-${section.key}`} style={styles.desktopStatusRow}>
                      <Text style={styles.desktopStatusTitle}>{section.title}</Text>
                      <View
                        style={[
                          styles.desktopStatusBadge,
                          isOwned ? styles.desktopStatusBadgeOwned : styles.desktopStatusBadgeMissing,
                        ]}>
                        <Text
                          style={[
                            styles.desktopStatusBadgeText,
                            isOwned ? styles.desktopStatusBadgeTextOwned : styles.desktopStatusBadgeTextMissing,
                          ]}>
                          {isOwned ? 'On file' : 'Quote needed'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.desktopStatusTotals}>
                <Text style={styles.desktopStatusTotalText}>Active: {desktopSummary.activeCount}</Text>
                <Text style={styles.desktopStatusTotalText}>Pending: {desktopSummary.pendingCount}</Text>
                <Text style={styles.desktopStatusTotalText}>Lapsed: {desktopSummary.lapsedCount}</Text>
              </View>
            </View>

            {missingSections.length > 0 ? (
              // Right rail mirrors missing-line quote actions so users can start from either column.
              <View style={styles.desktopRailCard}>
                <Text style={styles.desktopRailTitle}>Quick Quote Actions</Text>
                <View style={styles.desktopQuickActionList}>
                  {missingSections.map((section) => (
                    <Pressable
                      key={`quick-${section.key}`}
                      onPress={() => void handleQuotePress(section.formSlug)}
                    style={({ pressed }) => [
                        styles.desktopQuickAction,
                        pressed ? styles.desktopQuickActionPressed : null,
                      ]}>
                      <Text style={styles.desktopQuickActionTitle}>{section.title}</Text>
                      <Text style={styles.desktopQuickActionBody}>Request a Quote</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          {ownedSections.map(renderOwnedSection)}
          {missingSections.map(renderMissingSection)}
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
    flex: 1.75,
    gap: theme.spacing.md,
    minWidth: 0,
  },
  desktopSideColumn: {
    flex: 1,
    gap: theme.spacing.md,
    minWidth: 300,
  },
  desktopSectionPanel: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    ...theme.shadows.surface,
  },
  desktopRailCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  desktopRailTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  desktopSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  desktopSummaryItem: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    gap: 4,
  },
  desktopSummaryLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  desktopSummaryValue: {
    ...theme.typography.body,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  desktopStatusList: {
    gap: theme.spacing.xs,
  },
  desktopStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  desktopStatusTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    flex: 1,
  },
  desktopStatusBadge: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  desktopStatusBadgeOwned: {
    backgroundColor: '#EBF9F1',
    borderColor: '#C6EAD7',
  },
  desktopStatusBadgeMissing: {
    backgroundColor: '#FFF7EA',
    borderColor: '#EED3A8',
  },
  desktopStatusBadgeText: {
    ...theme.typography.caption,
    fontWeight: '700',
  },
  desktopStatusBadgeTextOwned: {
    color: theme.colors.success,
  },
  desktopStatusBadgeTextMissing: {
    color: '#A36A0A',
  },
  desktopStatusTotals: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  desktopStatusTotalText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  desktopQuickActionList: {
    gap: theme.spacing.xs,
  },
  desktopQuickAction: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    gap: 2,
  },
  desktopQuickActionPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  desktopQuickActionTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  desktopQuickActionBody: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  groupTitle: {
    ...theme.typography.label,
    color: theme.colors.textStrong,
  },
  sectionBlock: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  sectionContent: {
    gap: theme.spacing.sm,
  },
  quoteCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadows.surface,
  },
  quoteCardTitle: {
    ...theme.typography.body,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  quoteCardDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  quoteButton: {
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  quoteButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  quoteButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: '700',
  },
  skeletonHeader: {
    gap: theme.spacing.xs,
  },
  skeletonBlock: {
    borderRadius: theme.radius.pill,
    backgroundColor: '#DFE8E3',
    height: 11,
  },
  skeletonHeaderTitle: {
    width: '48%',
    height: 26,
    borderRadius: theme.radius.sm,
  },
  skeletonSectionTitle: {
    width: '38%',
    height: 20,
    borderRadius: theme.radius.sm,
  },
  skeletonPolicyCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  skeletonPolicyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  skeletonCarrier: {
    width: '62%',
    height: 18,
    borderRadius: theme.radius.sm,
  },
  skeletonStatusBadge: {
    width: 70,
    height: 24,
    borderRadius: theme.radius.pill,
    backgroundColor: '#D2DFD8',
  },
  skeletonPolicyNumber: {
    width: '44%',
  },
  skeletonMetricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  skeletonMetricColumn: {
    flex: 1,
    gap: 6,
  },
  skeletonMetricLabel: {
    width: '58%',
    height: 9,
  },
  skeletonMetricValue: {
    width: '72%',
    height: 13,
  },
  skeletonCardFooter: {
    width: '76%',
  },
  skeletonQuoteCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadows.surface,
  },
  skeletonQuoteTitle: {
    width: '42%',
    height: 16,
    borderRadius: theme.radius.sm,
  },
  skeletonQuoteLineWide: {
    width: '88%',
  },
  skeletonQuoteLineMedium: {
    width: '68%',
  },
  skeletonQuoteButton: {
    marginTop: theme.spacing.sm,
    width: 104,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: '#C4D5CC',
  },
  skeletonRailCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  skeletonRailTitle: {
    width: '56%',
    height: 18,
    borderRadius: theme.radius.sm,
  },
  skeletonRailLineWide: {
    width: '88%',
  },
  skeletonRailLineMedium: {
    width: '72%',
  },
  skeletonRailLineNarrow: {
    width: '54%',
  },
});
