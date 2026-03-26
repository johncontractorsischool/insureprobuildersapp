import { PropsWithChildren } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  backgroundTone?: 'default' | 'soft';
  includeTopInset?: boolean;
}>;

export function ScreenContainer({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  backgroundTone = 'default',
  includeTopInset = true,
}: ScreenContainerProps) {
  const content = (
    <View style={[styles.inner, style, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[
        styles.safe,
        backgroundTone === 'soft' ? styles.softBackground : styles.defaultBackground,
      ]}
      edges={includeTopInset ? ['top', 'left', 'right'] : ['left', 'right']}>
      <View pointerEvents="none" style={styles.glowPrimary} />
      <View pointerEvents="none" style={styles.glowSecondary} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        <View style={styles.noScrollContent}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  defaultBackground: {
    backgroundColor: theme.colors.background,
  },
  softBackground: {
    backgroundColor: theme.colors.backgroundSoft,
  },
  glowPrimary: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: '#D9F2E5',
    opacity: 0.55,
  },
  glowSecondary: {
    position: 'absolute',
    bottom: -140,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: '#F3F9F6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  noScrollContent: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: theme.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: theme.layout.screenHorizontal,
    paddingTop: 14,
    gap: theme.spacing.lg,
  },
});
