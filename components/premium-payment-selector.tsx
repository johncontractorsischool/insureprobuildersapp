import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import type { PremiumPaymentOption, PremiumPaymentTerms } from '@/types/payment';
import { formatCurrency } from '@/utils/format';

export function financingDescription(terms: PremiumPaymentTerms) {
  return `${formatCurrency(terms.downPayment)} down today, then ${terms.paymentCount} monthly ${terms.paymentCount === 1 ? 'payment' : 'payments'} of ${formatCurrency(terms.paymentAmount)}.`;
}

export function PremiumPaymentSelector({ fullAmount, financing, availableOptions, selected, disabled, onSelect }: {
  fullAmount: number;
  financing: PremiumPaymentTerms | null;
  availableOptions: PremiumPaymentOption[];
  selected: PremiumPaymentOption | null;
  disabled: boolean;
  onSelect: (choice: PremiumPaymentOption) => void;
}) {
  const options: {
    value: PremiumPaymentOption;
    label: string;
    detail: string;
    amount: number;
    amountLabel: string;
  }[] = [
    {
      value: 'FULL_PREMIUM',
      label: 'Full Premium',
      detail: `${formatCurrency(fullAmount)} today, plus processing fee.`,
      amount: fullAmount,
      amountLabel: 'Full premium today',
    },
    ...(financing ? [{
      value: 'FINANCED_PREMIUM' as const,
      label: 'Financed Premium',
      detail: financingDescription(financing),
      amount: financing.downPayment,
      amountLabel: 'Down payment today',
    }] : []),
  ];

  const offeredOptions = options.filter((option) => availableOptions.includes(option.value));

  return (
    <View style={styles.group}>
      <View style={styles.heading}>
        <Text style={styles.title}>Premium Payment</Text>
        <Text style={styles.subtitle}>{offeredOptions.length > 1 ? 'Choose how you’d like to pay.' : 'Payment option offered by your agent.'}</Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Premium Payment" style={styles.options}>
        {offeredOptions.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint={option.detail}
              accessibilityState={{ checked: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.selected,
                disabled && !isSelected && styles.inactive,
                pressed && !disabled && styles.pressed,
              ]}>
              <View style={styles.optionHeader}>
                <Text style={[styles.label, isSelected && styles.selectedText]}>{option.label}</Text>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected ? <Ionicons name="checkmark" size={15} color={theme.colors.white} /> : null}
                </View>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.amountLabel}>{option.amountLabel}</Text>
                <Text style={[styles.amount, isSelected && styles.selectedText]}>
                  {formatCurrency(option.amount)}
                </Text>
                <Text style={styles.fee}>+ processing fee</Text>
              </View>
              <View style={[styles.optionFooter, isSelected && styles.selectedFooter]}>
                <Ionicons
                  name={option.value === 'FINANCED_PREMIUM' ? 'calendar-outline' : 'checkmark-circle-outline'}
                  size={18}
                  color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={styles.schedule}>
                  {option.value === 'FINANCED_PREMIUM' && financing ? (
                    <>
                      Then {financing.paymentCount} monthly {financing.paymentCount === 1 ? 'payment' : 'payments'} of{' '}
                      <Text style={styles.monthlyAmount}>{formatCurrency(financing.paymentAmount)}</Text>
                    </>
                  ) : 'One premium payment'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {financing && availableOptions.includes('FINANCED_PREMIUM') ? (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
          <Text style={styles.noteText}>
            With financing, only the down payment and processing fee are collected today.
            {' '}The finance company handles the agreement and remaining monthly payments.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.spacing.md },
  heading: { gap: theme.spacing.xxs },
  title: { ...theme.typography.title, color: theme.colors.textStrong },
  subtitle: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  option: {
    flexBasis: 240,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceTint },
  inactive: { opacity: 0.65 },
  pressed: { backgroundColor: theme.colors.backgroundSoft },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  label: { ...theme.typography.body, flex: 1, fontWeight: '700', color: theme.colors.textStrong },
  selectedText: { color: theme.colors.primary },
  radio: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  radioSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  priceBlock: { gap: theme.spacing.xxs },
  amountLabel: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
  amount: { ...theme.typography.h1, color: theme.colors.textStrong, fontVariant: ['tabular-nums'] },
  fee: { ...theme.typography.caption, color: theme.colors.textMuted },
  optionFooter: {
    marginTop: 'auto',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  selectedFooter: { borderTopColor: theme.colors.borderStrong },
  schedule: { ...theme.typography.bodySmall, flex: 1, color: theme.colors.textMuted },
  monthlyAmount: { fontWeight: '700', color: theme.colors.textStrong },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs },
  noteText: { ...theme.typography.caption, flex: 1, color: theme.colors.textMuted },
});
