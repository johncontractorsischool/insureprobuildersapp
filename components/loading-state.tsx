import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type LoadingStateProps = {
  title?: string;
  description?: string;
};

export function LoadingState({
  title = 'Loading your coverage data',
  description = 'Preparing your secure portal experience.',
}: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.card}>
        <View style={[styles.line, styles.lineWide]} />
        <View style={[styles.line, styles.lineMedium]} />
        <View style={[styles.line, styles.lineNarrow]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  card: {
    marginTop: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  line: {
    height: 11,
    borderRadius: 999,
    backgroundColor: '#DFE8E3',
  },
  lineWide: {
    width: '90%',
  },
  lineMedium: {
    width: '70%',
  },
  lineNarrow: {
    width: '50%',
  },
});
