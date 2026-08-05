import { theme } from '@/constants/theme';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_CARD_COLOR = theme.colors.primary;

export const DIGITAL_CARD_COLOR_SWATCHES = [
  '#0B5B47',
  '#123F5A',
  '#2F5D50',
  '#6B4E2E',
  '#7A2E2E',
  '#374151',
] as const;

export function normalizeHexColor(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';

  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_COLOR_PATTERN.test(withHash) ? withHash.toUpperCase() : '';
}

export function isValidHexColor(value: string | null | undefined) {
  return Boolean(normalizeHexColor(value));
}

export function getDigitalCardPrimaryColor(value: string | null | undefined) {
  return normalizeHexColor(value) || DEFAULT_CARD_COLOR;
}

function toRgbChannel(hex: string, start: number) {
  return parseInt(hex.slice(start, start + 2), 16) / 255;
}

function toLinearRgb(channel: number) {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function getAccessibleForegroundColor(backgroundColor: string) {
  const normalized = getDigitalCardPrimaryColor(backgroundColor);
  const red = toLinearRgb(toRgbChannel(normalized, 1));
  const green = toLinearRgb(toRgbChannel(normalized, 3));
  const blue = toLinearRgb(toRgbChannel(normalized, 5));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.46 ? theme.colors.textStrong : theme.colors.white;
}
