import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { Policy } from '@/types/policy';
import { formatDate } from '@/utils/format';

type PolicyCardProps = {
  policy: Policy;
  onPress?: () => void;
  onRequestQuote?: () => void;
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

export function PolicyCard({ policy, onPress, onRequestQuote }: PolicyCardProps) {
  const status = statusStyles[policy.status];
  const showQuoteAction = policy.status === 'Lapsed' && Boolean(onRequestQuote);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.policyNumber}>Policy Number: {policy.policyNumber}</Text>
          <Text style={styles.carrierText}>Carrier: {policy.carrierName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
          <Text style={[styles.statusText, { color: status.textColor }]}>{policy.status}</Text>
        </View>
      </View>

      <View style={styles.datesRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Effective Date</Text>
          <Text style={styles.metricValue}>{formatDate(policy.effectiveDate)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Expiration Date</Text>
          <Text style={styles.metricValue}>{formatDate(policy.expirationDate)}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          style={({ pressed }) => [
            styles.primaryAction,
            !onPress ? styles.actionDisabled : null,
            pressed && onPress ? styles.pressed : null,
          ]}>
          <Text style={styles.primaryActionText}>View Policy Details</Text>
        </Pressable>

        {showQuoteAction ? (
          <Pressable
            onPress={onRequestQuote}
            style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}>
            <Text style={styles.secondaryActionText}>Request a Quote</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  carrierText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  policyNumber: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '700',
  },
  datesRow: {
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
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  primaryAction: {
    flex: 1,
    minWidth: 170,
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  secondaryAction: {
    flex: 1,
    minWidth: 170,
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  primaryActionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryActionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
