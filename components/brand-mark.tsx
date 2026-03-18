import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type BrandMarkProps = {
  size?: number;
  withWordmark?: boolean;
};

export function BrandMark({ size = 58, withWordmark = true }: BrandMarkProps) {
  const iconSize = Math.max(20, Math.round(size * 0.45));

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.34 }]}>
        <View style={styles.badgeInner}>
          <Ionicons name="shield-checkmark" size={iconSize} color={theme.colors.white} />
        </View>
      </View>
      {withWordmark ? (
        <View>
          <Text style={styles.wordmarkTop}>InsurePro</Text>
          <Text style={styles.wordmarkBottom}>Customer Portal</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.elevated,
  },
  badgeInner: {
    width: '78%',
    height: '78%',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmarkTop: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  wordmarkBottom: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
