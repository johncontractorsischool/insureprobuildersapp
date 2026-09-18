import { useId } from 'react';

import type { StateSelectProps } from '@/components/state-select.types';
import { theme } from '@/constants/theme';
import { isFullUsStateName, normalizeUsStateName, US_STATE_OPTIONS } from '@/utils/account-payment';

export function StateSelect({ value, onChange, disabled = false }: StateSelectProps) {
  const id = useId();
  const normalizedValue = normalizeUsStateName(value);
  const selectedValue = isFullUsStateName(normalizedValue) ? normalizedValue : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
      <label htmlFor={id} style={{
        fontFamily: theme.typography.caption.fontFamily,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: theme.typography.caption.fontWeight,
        color: theme.colors.textMuted,
        letterSpacing: 0.35,
        textTransform: 'uppercase',
      }}>State</label>
      <select
        id={id}
        aria-label="State"
        autoComplete="address-level1"
        value={selectedValue}
        disabled={disabled}
        onChange={(event) => {
          const stateName = event.currentTarget.value;
          if (!disabled && US_STATE_OPTIONS.some((option) => option.value === stateName)) {
            onChange(stateName);
          }
        }}
        style={{
          width: '100%',
          minWidth: 0,
          minHeight: 56,
          padding: `0 ${theme.spacing.md}px`,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface,
          color: selectedValue ? theme.colors.textStrong : theme.colors.textSubtle,
          fontFamily: theme.typography.body.fontFamily,
          fontSize: theme.typography.body.fontSize,
          fontWeight: theme.typography.body.fontWeight,
          opacity: disabled ? 0.65 : 1,
        }}>
        <option value="" disabled>Select a state</option>
        {US_STATE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
