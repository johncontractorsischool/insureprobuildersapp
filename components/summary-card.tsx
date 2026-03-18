import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type SummaryCardProps = {
  label: string;
  value: string;
  highlight?: 'green' | 'red' | 'neutral';
};

const accents = {
  green: '#E9F7EF',
  red: '#FDF1F2',
  neutral: '#F3F6F5',
} as const;

export function SummaryCard({ label, value, highlight = 'neutral' }: SummaryCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: accents[highlight] }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 102,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    justifyContent: 'space-between',
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  value: {
    ...theme.typography.h2,
    color: theme.colors.textStrong,
  },
});
