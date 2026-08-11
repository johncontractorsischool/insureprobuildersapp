import type { DigitalCardInsuranceSummary } from '@/types/digital-card';
import type { Policy } from '@/types/policy';

const MAX_PUBLIC_INSURANCE_LINES = 4;

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function normalizeLineKey(value: string) {
  return normalizeText(value).toLowerCase();
}

function toPublicCoverageLabel(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return '';

  return normalized
    .replace(/\bgl\b/gi, 'General Liability')
    .replace(/\bwc\b/gi, 'Workers Compensation');
}

export function buildDigitalCardInsuranceSummary(policies: Policy[]): DigitalCardInsuranceSummary[] {
  const activePolicies = policies.filter((policy) => policy.status === 'Active');
  const seen = new Set<string>();
  const summaries: DigitalCardInsuranceSummary[] = [];

  activePolicies.forEach((policy) => {
    const coverageLabel = toPublicCoverageLabel(policy.productName);
    const key = normalizeLineKey(coverageLabel);
    if (!coverageLabel || seen.has(key)) return;

    seen.add(key);
    summaries.push({
      label: coverageLabel,
      detail: 'Active policy on file',
    });
  });

  return summaries.slice(0, MAX_PUBLIC_INSURANCE_LINES);
}

export function normalizeDigitalCardInsuranceSummary(value: unknown): DigitalCardInsuranceSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const maybeEntry = entry as Partial<DigitalCardInsuranceSummary>;
      const label = normalizeText(maybeEntry.label);
      const detail = normalizeText(maybeEntry.detail);
      if (!label || !detail) return null;
      return { label, detail };
    })
    .filter((entry): entry is DigitalCardInsuranceSummary => Boolean(entry))
    .slice(0, MAX_PUBLIC_INSURANCE_LINES);
}
