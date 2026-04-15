import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import type { CompanyStatusChip } from '@/hooks/use-company-profile';
import { useCompanyProfile } from '@/hooks/use-company-profile';
import { openInAppBrowser } from '@/utils/external-actions';

const COMPANY_STATUS_CHIP_STYLES: Record<
  CompanyStatusChip,
  { backgroundColor: string; textColor: string }
> = {
  Active: {
    backgroundColor: '#EBF9F1',
    textColor: theme.colors.success,
  },
  'Needs Attention': {
    backgroundColor: theme.colors.dangerSoft,
    textColor: theme.colors.danger,
  },
};

type CompanyDetailScreenProps = {
  showInContentBackButton?: boolean;
};

export default function CompanyDetailScreen({
  showInContentBackButton = false,
}: CompanyDetailScreenProps) {
  const {
    isLoadingCompany,
    companyLookupNotice,
    cslbLink,
    licenseRows,
    statusChips,
    statusFallbackText,
    businessName,
    businessRows,
    classifications,
    bonding,
    workersCompRows,
    personnel,
    hasDetailContent,
  } = useCompanyProfile();

  const openCslb = async () => {
    const result = await openInAppBrowser(cslbLink, 'CSLB link is not available yet.');
    if (!result.ok) {
      Alert.alert('Action unavailable', result.message ?? 'CSLB link is not available yet.');
    }
  };
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer includeTopInset={false}>
      {showInContentBackButton ? (
        <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      ) : null}

      {businessName || businessRows.length > 0 ? (
        <>
          <SectionHeader title="Business Information" />
          <View style={styles.card}>
            {businessName ? <Text style={styles.title}>{businessName}</Text> : null}
            {businessRows.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="License" subtitle="Details from CSLB website" />

      <View style={styles.card}>
        {licenseRows.length > 0 ? (
          licenseRows.map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              {row.label === 'Status' ? (
                statusChips.length > 0 ? (
                  <View style={styles.statusChipRow}>
                    {statusChips.map((chip) => {
                      const chipStyle = COMPANY_STATUS_CHIP_STYLES[chip];
                      return (
                        <View
                          key={chip}
                          style={[styles.statusChip, { backgroundColor: chipStyle.backgroundColor }]}>
                          <Text style={[styles.statusChipText, { color: chipStyle.textColor }]}>{chip}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.infoValue}>{statusFallbackText}</Text>
                )
              ) : (
                <Text style={styles.infoValue}>{row.value}</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.caption}>License details are not available yet.</Text>
        )}

        {isLoadingCompany ? <Text style={styles.caption}>Loading CSLB details...</Text> : null}
        {companyLookupNotice ? <Text style={styles.caption}>{companyLookupNotice}</Text> : null}

        <Pressable
          onPress={() => {
            void openCslb();
          }}
          disabled={!cslbLink}
          style={({ pressed }) => [
            styles.linkButton,
            !cslbLink ? styles.disabled : null,
            pressed && cslbLink ? styles.pressed : null,
          ]}>
          <Text style={styles.linkButtonText}>View on CSLB</Text>
        </Pressable>
      </View>

      {!isLoadingCompany && !hasDetailContent ? (
        <View style={styles.card}>
          <EmptyState
            icon="information-circle-outline"
            title="No business details available"
            description="Detailed records from the CSLB website have not been provided for this license yet."
          />
        </View>
      ) : null}

      {classifications.length > 0 ? (
        <>
          <SectionHeader title="Classifications" />
          <View style={styles.card}>
            {classifications.map((classification, index) => (
              <Text key={`${classification}-${index}`} style={styles.listLine}>
                • {classification}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {bonding.length > 0 ? (
        <>
          <SectionHeader title="Bonding" />
          <View style={styles.card}>
            {bonding.map((bond) => (
              <View key={bond.id} style={styles.groupCard}>
                <Text style={styles.title}>{bond.title}</Text>
                {bond.rows.map((row) => (
                  <View key={`${bond.id}-${row.label}`} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={styles.infoValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {workersCompRows.length > 0 ? (
        <>
          <SectionHeader title="Workers' Compensation" />
          <View style={styles.card}>
            {workersCompRows.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {personnel.length > 0 ? (
        <>
          <SectionHeader title="Personnel" />
          <View style={styles.card}>
            {personnel.map((member) => (
              <View key={member.id} style={styles.groupCard}>
                <Text style={styles.title}>{member.title}</Text>
                {member.rows.map((row) => (
                  <View key={`${member.id}-${row.label}`} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={styles.infoValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: -6,
    paddingVertical: 2,
  },
  backButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  title: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  infoLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flex: 1,
  },
  infoValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  statusChipRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  statusChip: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipText: {
    ...theme.typography.caption,
    fontWeight: '700',
  },
  listLine: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
  },
  groupCard: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: 4,
  },
  linkButton: {
    marginTop: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceTint,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  linkButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.94,
  },
});
