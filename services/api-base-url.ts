import { Platform } from 'react-native';

const ANDROID_EMULATOR_HOST = '10.0.2.2';
const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

export function normalizeApiBaseUrlForRuntime(baseUrl: string, platform = Platform.OS) {
  const trimmed = stripTrailingSlashes(baseUrl.trim());
  if (platform !== 'android') return trimmed;

  try {
    const url = new URL(trimmed);
    if (LOCALHOST_NAMES.has(url.hostname)) {
      url.hostname = ANDROID_EMULATOR_HOST;
    }

    return stripTrailingSlashes(url.toString());
  } catch {
    return trimmed;
  }
}

export function resolveApiBaseUrl(...candidates: Array<string | null | undefined>) {
  const selected = candidates.find((candidate) => candidate?.trim());
  return normalizeApiBaseUrlForRuntime(selected ?? '');
}
