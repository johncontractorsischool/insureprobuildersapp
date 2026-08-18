import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type LoadingStateProps = {
  title?: string;
  description?: string;
  variant?: 'card' | 'centered';
};

export function LoadingState({
  title = 'Loading your coverage data',
  description = 'Preparing your secure portal experience.',
  variant = 'card',
}: LoadingStateProps) {
  const isCentered = variant === 'centered';

  return (
    <View style={[styles.container, isCentered ? styles.centeredContainer : null]}>
      {isCentered ? (
        <View style={styles.indicatorWrap}>
          <ActivityIndicator
            accessibilityLabel={title}
            color={theme.colors.primary}
            size="large"
          />
        </View>
      ) : null}
      <Text style={[styles.title, isCentered ? styles.centeredText : null]}>{title}</Text>
      <Text style={[styles.description, isCentered ? styles.centeredText : null]}>{description}</Text>
      {!isCentered ? (
        <View style={styles.card}>
          <View style={[styles.line, styles.lineWide]} />
          <View style={[styles.line, styles.lineMedium]} />
          <View style={[styles.line, styles.lineNarrow]} />
        </View>
      ) : null}
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
  centeredContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
  },
  indicatorWrap: {
    width: 64,
    height: 64,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.surface,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  centeredText: {
    textAlign: 'center',
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
