import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import type { PaymentEligibility } from '@/types/payment';
import { buildPaymentRecordLabel, getPaymentPurposeLabel } from '@/utils/account-payment';
import { formatCurrency } from '@/utils/format';

type PaymentDueCardProps = {
  record: PaymentEligibility;
  onMakePayment: () => void;
  isDesktopLayout?: boolean;
};

function formatDueDate(value: string | null) {
  if (!value) return 'Payment requested';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Payment requested';
  return `Due ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)}`;
}

export function PaymentDueCard({
  record,
  onMakePayment,
  isDesktopLayout = false,
}: PaymentDueCardProps) {
  const recordLabel = buildPaymentRecordLabel(record);

  return (
    <View
      accessibilityLabel={`Payment due. Amount due ${formatCurrency(record.amountDue)}. ${formatDueDate(record.dueDate)}.`}
      style={[styles.card, isDesktopLayout ? styles.desktopCard : styles.mobileCard]}>
      <View pointerEvents="none" style={styles.ringOuter} />
      <View pointerEvents="none" style={styles.ringMiddle} />
      <View pointerEvents="none" style={styles.ringInner} />

      <View style={[styles.statusBlock, isDesktopLayout ? styles.desktopStatusBlock : null]}>
        <View style={styles.paymentIcon}>
          <Ionicons name="card-outline" size={20} color={theme.colors.white} />
        </View>
        <View style={styles.statusCopy}>
          <View style={styles.actionBadge}>
            <Ionicons name="alert-circle-outline" size={13} color={theme.colors.white} />
            <Text style={styles.actionBadgeText}>Action Required</Text>
          </View>
          <Text style={styles.paymentTitle}>Payment Due</Text>
          <Text style={styles.paymentDueDate}>{formatDueDate(record.dueDate)}</Text>
        </View>
      </View>

      {isDesktopLayout ? <View style={styles.desktopDivider} /> : null}

      <View style={[styles.amountBlock, isDesktopLayout ? styles.desktopAmountBlock : null]}>
        <Text style={styles.amountLabel}>Amount Due</Text>
        <Text style={styles.amountValue}>{formatCurrency(record.amountDue)}</Text>
      </View>

      <View style={[styles.lineItems, isDesktopLayout ? styles.desktopLineItems : null]}>
        <View style={styles.lineItem}>
          <Text style={styles.lineItemLabel} numberOfLines={1}>{recordLabel}</Text>
          <Text style={styles.lineItemValue}>{getPaymentPurposeLabel(record.purpose)}</Text>
        </View>
        {record.clientMessage ? (
          <Text style={styles.clientMessage} numberOfLines={isDesktopLayout ? 2 : 3}>
            {record.clientMessage}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pay now"
        onPress={onMakePayment}
        style={({ pressed }) => [
          styles.paymentButton,
          isDesktopLayout ? styles.desktopPaymentButton : null,
          pressed ? styles.paymentButtonPressed : null,
        ]}>
        <Ionicons name="card-outline" size={18} color={theme.colors.primaryDeep} />
        <Text style={styles.paymentButtonText}>Pay Now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    backgroundColor: '#135540',
    ...theme.shadows.elevated,
  },
  mobileCard: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  desktopCard: {
    minHeight: 100,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  ringOuter: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: theme.radius.pill,
    borderWidth: 20,
    borderColor: 'rgba(255,255,255,0.10)',
    right: -35,
    top: -35,
  },
  ringMiddle: {
    position: 'absolute',
    width: 105,
    height: 105,
    borderRadius: theme.radius.pill,
    borderWidth: 14,
    borderColor: 'rgba(255,255,255,0.08)',
    right: -12,
    top: -12,
  },
  ringInner: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(4,45,34,0.55)',
    right: 13,
    top: 13,
  },
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    zIndex: 1,
  },
  desktopStatusBlock: {
    minWidth: 175,
  },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusCopy: {
    gap: 1,
  },
  actionBadge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    backgroundColor: '#F6A900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 14,
  },
  paymentTitle: {
    ...theme.typography.title,
    color: theme.colors.white,
  },
  paymentDueDate: {
    ...theme.typography.caption,
    color: '#C4DBD2',
  },
  desktopDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  amountBlock: {
    zIndex: 1,
  },
  desktopAmountBlock: {
    minWidth: 145,
  },
  amountLabel: {
    ...theme.typography.caption,
    color: '#AFCFC2',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  amountValue: {
    ...theme.typography.h1,
    color: theme.colors.white,
  },
  lineItems: {
    zIndex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  desktopLineItems: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  lineItem: {
    minWidth: 92,
    maxWidth: '100%',
    flexShrink: 1,
    gap: 1,
  },
  lineItemLabel: {
    ...theme.typography.caption,
    color: '#C4DBD2',
  },
  lineItemValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: '700',
  },
  clientMessage: {
    ...theme.typography.caption,
    color: '#C4DBD2',
    flexShrink: 1,
    width: '100%',
  },
  paymentButton: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    zIndex: 1,
  },
  desktopPaymentButton: {
    minWidth: 182,
  },
  paymentButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primaryDeep,
    fontWeight: '700',
  },
  paymentButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
