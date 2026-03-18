import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { Policy } from '@/types/policy';
import { formatCurrency, formatDate } from '@/utils/format';

type PolicyCardProps = {
  policy: Policy;
  onPress?: () => void;
};

const statusStyles = {
  Active: {
    backgroundColor: '#EBF9F1',
    textColor: theme.colors.success,
  },
  Pending: {
    backgroundColor: '#FFF7EA',
    textColor: '#A36A0A',
  },
  Lapsed: {
    backgroundColor: theme.colors.dangerSoft,
    textColor: theme.colors.danger,
  },
} as const;

export function PolicyCard({ policy, onPress }: PolicyCardProps) {
  const status = statusStyles[policy.status];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{policy.productName}</Text>
          <Text style={styles.policyNumber}>Policy {policy.policyNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
          <Text style={[styles.statusText, { color: status.textColor }]}>{policy.status}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Monthly premium</Text>
          <Text style={styles.metricValue}>{formatCurrency(policy.premiumMonthly)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Effective date</Text>
          <Text style={styles.metricValue}>{formatDate(policy.effectiveDate)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
        <Text style={styles.footerText}>{policy.insuredItem}</Text>
        {onPress ? (
          <Ionicons name="chevron-forward" size={17} color={theme.colors.textSubtle} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.surface,
  },
  pressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.94,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  policyNumber: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  statusText: {
    ...theme.typography.caption,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  metric: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceTint,
    gap: 4,
  },
  metricLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  metricValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  footerText: {
    ...theme.typography.bodySmall,
    flex: 1,
    color: theme.colors.textMuted,
  },
});
