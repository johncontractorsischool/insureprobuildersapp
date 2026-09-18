import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StateSelectProps } from '@/components/state-select.types';
import { theme } from '@/constants/theme';
import { isFullUsStateName, normalizeUsStateName, US_STATE_OPTIONS } from '@/utils/account-payment';

export function StateSelect({ value, onChange, disabled = false }: StateSelectProps) {
  const [open, setOpen] = useState(false);
  const normalizedValue = normalizeUsStateName(value);
  const selectedValue = isFullUsStateName(normalizedValue) ? normalizedValue : '';
  const close = () => setOpen(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>State</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="State"
        accessibilityHint="Choose your billing state"
        accessibilityValue={{ text: selectedValue || 'Select a state' }}
        accessibilityState={{ disabled, expanded: open && !disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={[styles.field, disabled && styles.disabled]}>
        <Text style={[styles.value, !selectedValue && styles.placeholder]}>
          {selectedValue || 'Select a state'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
      </Pressable>

      {open && !disabled ? (
        <Modal transparent animationType="fade" onRequestClose={close}>
          <View style={styles.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessible={false}
            />
            <View style={styles.dialog} accessibilityViewIsModal>
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>Select a state</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close state selection" onPress={close} style={styles.close}>
                  <Ionicons name="close" size={24} color={theme.colors.textStrong} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View accessibilityRole="radiogroup" accessibilityLabel="States">
                  {US_STATE_OPTIONS.map((option) => {
                    const selected = option.value === selectedValue;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityLabel={option.label}
                        accessibilityState={{ checked: selected }}
                        onPress={() => {
                          if (disabled) return;
                          onChange(option.value);
                          close();
                        }}
                        style={[styles.option, selected && styles.selectedOption]}>
                        <Text style={[styles.optionLabel, selected && styles.selectedLabel]}>{option.label}</Text>
                        {selected ? <Ionicons name="checkmark" size={20} color={theme.colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.xs },
  label: { ...theme.typography.caption, color: theme.colors.textMuted, letterSpacing: 0.35, textTransform: 'uppercase' },
  field: {
    minHeight: 56,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  value: { ...theme.typography.body, flex: 1, color: theme.colors.textStrong },
  placeholder: { color: theme.colors.textSubtle },
  disabled: { opacity: 0.65 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl, backgroundColor: 'rgba(8, 61, 49, 0.4)' },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '80%', borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { ...theme.typography.title, flex: 1, color: theme.colors.textStrong },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  option: { minHeight: 48, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  selectedOption: { backgroundColor: theme.colors.surfaceTint },
  optionLabel: { ...theme.typography.body, flex: 1, color: theme.colors.textStrong },
  selectedLabel: { color: theme.colors.primary, fontWeight: '700' },
});
