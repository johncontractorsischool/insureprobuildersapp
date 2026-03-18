import { Platform, TextStyle, ViewStyle } from 'react-native';

const displayFont =
  Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif-medium',
    web: '"Avenir Next", "Segoe UI", sans-serif',
    default: 'System',
  }) ?? 'System';

const bodyFont =
  Platform.select({
    ios: 'Avenir',
    android: 'sans-serif',
    web: '"Segoe UI", "Helvetica Neue", sans-serif',
    default: 'System',
  }) ?? 'System';

const monoFont =
  Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: '"JetBrains Mono", Menlo, monospace',
    default: 'monospace',
  }) ?? 'monospace';

const surfaceShadow: ViewStyle = {
  shadowColor: '#0C1E18',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 3,
};

const elevatedShadow: ViewStyle = {
  shadowColor: '#08140F',
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.12,
  shadowRadius: 22,
  elevation: 6,
};

export const theme = {
  colors: {
    primary: '#0B5B47',
    primaryDeep: '#083D31',
    primaryAccent: '#26A56D',
    success: '#0E8A57',
    danger: '#B92C36',
    dangerSoft: '#FDF1F2',
    textStrong: '#151B18',
    textMuted: '#5C6662',
    textSubtle: '#7E8985',
    border: '#D7E2DD',
    borderStrong: '#B8CAC2',
    background: '#F7FAF8',
    backgroundSoft: '#EEF4F1',
    surface: '#FFFFFF',
    surfaceTint: '#F3F8F5',
    tabInactive: '#8B9792',
    white: '#FFFFFF',
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 26,
    pill: 999,
  },
  typography: {
    display: {
      fontFamily: displayFont,
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: -0.6,
      lineHeight: 40,
    } as TextStyle,
    h1: {
      fontFamily: displayFont,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
      lineHeight: 34,
    } as TextStyle,
    h2: {
      fontFamily: displayFont,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.3,
      lineHeight: 28,
    } as TextStyle,
    title: {
      fontFamily: bodyFont,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
    } as TextStyle,
    body: {
      fontFamily: bodyFont,
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 23,
    } as TextStyle,
    bodySmall: {
      fontFamily: bodyFont,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    } as TextStyle,
    label: {
      fontFamily: bodyFont,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
      lineHeight: 18,
      textTransform: 'uppercase',
    } as TextStyle,
    caption: {
      fontFamily: bodyFont,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
      lineHeight: 16,
    } as TextStyle,
    mono: {
      fontFamily: monoFont,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    } as TextStyle,
  },
  shadows: {
    surface: surfaceShadow,
    elevated: elevatedShadow,
    nav: {
      shadowColor: '#0A1813',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 8,
    } as ViewStyle,
  },
  layout: {
    screenHorizontal: 20,
    maxContentWidth: 560,
  },
};

export const Colors = {
  light: {
    text: theme.colors.textStrong,
    background: theme.colors.background,
    tint: theme.colors.primary,
    icon: theme.colors.tabInactive,
    tabIconDefault: theme.colors.tabInactive,
    tabIconSelected: theme.colors.primary,
  },
  dark: {
    text: theme.colors.textStrong,
    background: theme.colors.background,
    tint: theme.colors.primary,
    icon: theme.colors.tabInactive,
    tabIconDefault: theme.colors.tabInactive,
    tabIconSelected: theme.colors.primary,
  },
};

export const Fonts = {
  sans: bodyFont,
  serif: bodyFont,
  rounded: displayFont,
  mono: monoFont,
};
