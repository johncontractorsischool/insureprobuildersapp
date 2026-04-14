import { createContext, PropsWithChildren, useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

type ScreenContainerSettings = {
  maxContentWidth?: number;
};

const ScreenContainerSettingsContext = createContext<ScreenContainerSettings>({});

type ScreenContainerSettingsProviderProps = PropsWithChildren<{
  maxContentWidth?: number;
}>;

export function ScreenContainerSettingsProvider({
  children,
  maxContentWidth,
}: ScreenContainerSettingsProviderProps) {
  return (
    <ScreenContainerSettingsContext.Provider value={{ maxContentWidth }}>
      {children}
    </ScreenContainerSettingsContext.Provider>
  );
}

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  backgroundTone?: 'default' | 'soft';
  includeTopInset?: boolean;
  maxContentWidth?: number;
  keyboardAware?: boolean;
  keyboardVerticalOffset?: number;
}>;

export function ScreenContainer({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  backgroundTone = 'default',
  includeTopInset = true,
  maxContentWidth,
  keyboardAware = false,
  keyboardVerticalOffset = 0,
}: ScreenContainerProps) {
  const containerSettings = useContext(ScreenContainerSettingsContext);
  const resolvedMaxContentWidth =
    maxContentWidth ?? containerSettings.maxContentWidth ?? theme.layout.maxContentWidth;

  const content = (
    <View
      style={[
        styles.innerBase,
        scroll ? styles.innerScroll : styles.innerNoScroll,
        { maxWidth: resolvedMaxContentWidth },
        style,
        contentContainerStyle,
      ]}>
      {children}
    </View>
  );

  const scrollContent = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === 'ios'}>
      {content}
    </ScrollView>
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
        keyboardAware && Platform.OS === 'android' ? (
          <KeyboardAvoidingView
            style={styles.keyboardAware}
            behavior="height"
            keyboardVerticalOffset={keyboardVerticalOffset}>
            {scrollContent}
          </KeyboardAvoidingView>
        ) : (
          scrollContent
        )
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
  keyboardAware: {
    flex: 1,
  },
  innerBase: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: theme.layout.screenHorizontal,
    paddingTop: 14,
    gap: theme.spacing.lg,
  },
  innerScroll: {
    flexGrow: 1,
  },
  innerNoScroll: {
    flex: 1,
  },
});
