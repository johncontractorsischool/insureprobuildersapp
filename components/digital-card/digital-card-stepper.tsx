import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

export type DigitalCardStep = 'template' | 'details' | 'share';

const STEPS: { key: DigitalCardStep; label: string }[] = [
  { key: 'template', label: 'Template' },
  { key: 'details', label: 'Details' },
  { key: 'share', label: 'Share' },
];

export function DigitalCardStepper({ currentStep }: { currentStep: DigitalCardStep }) {
  const currentIndex = STEPS.findIndex((step) => step.key === currentStep);

  return (
    <View accessibilityRole="tablist" style={styles.wrapper}>
      {STEPS.map((step, index) => {
        const isActive = step.key === currentStep;
        const isComplete = index < currentIndex;

        return (
          <View
            key={step.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[styles.step, isActive ? styles.stepActive : null]}>
            <View style={[styles.dot, isActive || isComplete ? styles.dotActive : null]}>
              <Text style={[styles.dotText, isActive || isComplete ? styles.dotTextActive : null]}>
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  step: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
  },
  stepActive: {
    borderColor: theme.colors.primaryAccent,
    backgroundColor: theme.colors.surfaceTint,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: theme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
  },
  dotText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  dotTextActive: {
    color: theme.colors.white,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  labelActive: {
    color: theme.colors.primaryDeep,
  },
});
