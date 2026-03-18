import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { theme } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type AppInputProps = TextInputProps & {
  label: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: IconName;
};

export function AppInput({
  label,
  helperText,
  errorText,
  leftIcon,
  onFocus,
  onBlur,
  style,
  ...props
}: AppInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused ? styles.focused : null,
          errorText ? styles.errorWrap : null,
        ]}>
        {leftIcon ? <Ionicons name={leftIcon} size={18} color={theme.colors.textSubtle} /> : null}
        <TextInput
          {...props}
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.textSubtle}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
      </View>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
      {!errorText && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  inputWrap: {
    minHeight: 56,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textStrong,
    paddingVertical: theme.spacing.sm,
  },
  focused: {
    borderColor: theme.colors.primaryAccent,
    shadowColor: theme.colors.primaryAccent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 2,
  },
  errorWrap: {
    borderColor: theme.colors.danger,
  },
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
});
