import { Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type BrandMarkProps = {
  size?: number;
  withWordmark?: boolean;
  compactWordmark?: boolean;
};

export function BrandMark({
  size = 58,
  withWordmark = true,
  compactWordmark = false,
}: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.logoWrap, { width: size, height: size }]}>
        <Image source={require('../assets/images/pbialogo.png')} style={styles.iconImage} resizeMode="contain" />
      </View>
      {withWordmark ? (
        <View>
          <Text style={[styles.wordmarkTop, compactWordmark ? styles.wordmarkTopCompact : null]}>
            Insure Probuilders
          </Text>
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
  logoWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: '132%',
    height: '132%',
  },
  wordmarkTop: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  wordmarkTopCompact: {
    fontSize: 17,
    lineHeight: 22,
  },
  wordmarkBottom: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
