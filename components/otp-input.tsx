import { useMemo, useRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { theme } from '@/constants/theme';

type OTPInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
};

export function OTPInput({ value, onChange, length = 6 }: OTPInputProps) {
  const refs = useRef<(TextInput | null)[]>([]);
  const webInputReset =
    Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0, boxShadow: 'none' } as any)
      : undefined;
  const digits = useMemo(
    () => Array.from({ length }, (_, index) => value[index] ?? ''),
    [length, value]
  );

  const applyDigits = (incoming: string, fromIndex: number) => {
    const filtered = incoming.replace(/\D/g, '');
    const next = Array.from({ length }, (_, index) => value[index] ?? '');

    if (!filtered) {
      next[fromIndex] = '';
      onChange(next.join(''));
      return;
    }

    filtered.split('').forEach((digit, offset) => {
      const target = fromIndex + offset;
      if (target < length) next[target] = digit;
    });

    onChange(next.join(''));

    const focusIndex = Math.min(fromIndex + filtered.length, length - 1);
    if (focusIndex === length - 1 && next[length - 1]) {
      refs.current[length - 1]?.blur();
      return;
    }
    refs.current[focusIndex]?.focus();
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            refs.current[index] = ref;
          }}
          value={digit}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          selectionColor={theme.colors.primary}
          onChangeText={(text) => applyDigits(text, index)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          style={[styles.cell, webInputReset, digit ? styles.filled : null]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    maxWidth: 64,
    minHeight: 58,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    textAlign: 'center',
    ...theme.typography.h2,
    color: theme.colors.textStrong,
  },
  filled: {
    borderColor: theme.colors.primaryAccent,
    backgroundColor: theme.colors.surfaceTint,
  },
});
