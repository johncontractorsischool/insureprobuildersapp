import { withApiKeyHeader } from '@/services/api-request-headers';
import { formatDate } from '@/utils/format';

const DEFAULT_POLICY_COVERAGES_API_BASE_URL = 'http://localhost:3500';

const COVERAGE_METADATA_FIELDS = new Set([
  'databaseId',
  'lineOfBusinessId',
  'policyId',
  'lineOfBusinessName',
  'createDate',
  'changeDate',
]);

const COVERAGE_FIELD_LABELS: Record<string, string> = {
  memberExcluded: 'Member Excluded',
  limitWCStatLimits: 'WC Statutory Limits',
  limitOtherCheckbox: 'Other Limit Selected',
  limitOtherValue: 'Other Limit',
  limitEachAccident: 'Each Accident Limit',
  limitEAEmployee: 'Each Employee Limit',
  limitPolicy: 'Policy Limit',
};

const COVERAGE_FIELD_ORDER = [
  'limitWCStatLimits',
  'limitEachAccident',
  'limitEAEmployee',
  'limitPolicy',
  'limitOtherValue',
  'memberExcluded',
] as const;

const HIDDEN_COVERAGE_VALUES = new Set(['null', 'undefined', 'n/a', 'na', 'none']);

export type PolicyCoverageRow = {
  label: string;
  value: string;
};

export type PolicyCoverageGroup = {
  id: string;
  title: string;
  rows: PolicyCoverageRow[];
};

function getPolicyCoveragesApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_POLICY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() ||
    DEFAULT_POLICY_COVERAGES_API_BASE_URL
  );
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (HIDDEN_COVERAGE_VALUES.has(normalized.toLowerCase())) return null;
  return normalized;
}

function toObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isIsoDateLike(value: string) {
  return /\d{4}-\d{2}-\d{2}/.test(value);
}

function toReadableCoverageLabel(value: string) {
  const directLabel = COVERAGE_FIELD_LABELS[value];
  if (directLabel) return directLabel;

  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (token) => token.toUpperCase());
}

function toReadableCoverageTitle(value: string) {
  return value
    .replace(/Coverages$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (token) => token.toUpperCase());
}

function isCurrencyLikeCoverageKey(key: string) {
  return (
    key.startsWith('limit') &&
    key !== 'limitWCStatLimits' &&
    key !== 'limitOtherCheckbox'
  );
}

function formatCoverageCurrency(value: string | number) {
  const numericValue =
    typeof value === 'number'
      ? value
      : Number.parseFloat(value.replace(/[$,\s]/g, ''));

  if (!Number.isFinite(numericValue)) return null;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function normalizeCoverageValue(key: string, value: unknown) {
  if (typeof value === 'boolean') {
    if (key === 'limitOtherCheckbox') return null;
    return value ? 'Yes' : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (isCurrencyLikeCoverageKey(key)) {
      return formatCoverageCurrency(value);
    }
    return String(value);
  }

  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (isIsoDateLike(normalized)) {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDate(normalized);
    }
  }

  if (isCurrencyLikeCoverageKey(key)) {
    const formattedCurrency = formatCoverageCurrency(normalized);
    if (formattedCurrency) return formattedCurrency;
  }

  return normalized;
}

function toCoverageRows(entry: Record<string, unknown>) {
  const sortableRows = Object.entries(entry)
    .filter(([key]) => !COVERAGE_METADATA_FIELDS.has(key))
    .map(([key, value]) => {
      const normalizedValue = normalizeCoverageValue(key, value);
      if (!normalizedValue) return null;

      return {
        key,
        row: {
          label: toReadableCoverageLabel(key),
          value: normalizedValue,
        },
      };
    })
    .filter((entry): entry is { key: string; row: PolicyCoverageRow } => Boolean(entry));

  sortableRows.sort((left, right) => {
    const leftIndex = COVERAGE_FIELD_ORDER.indexOf(left.key as (typeof COVERAGE_FIELD_ORDER)[number]);
    const rightIndex = COVERAGE_FIELD_ORDER.indexOf(right.key as (typeof COVERAGE_FIELD_ORDER)[number]);

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.row.label.localeCompare(right.row.label);
  });

  return sortableRows.map((entry) => entry.row);
}

function mapPolicyCoveragesPayload(payload: unknown): PolicyCoverageGroup[] {
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected policy coverages response format.');
  }

  return payload.reduce<PolicyCoverageGroup[]>((groups, bucket, bucketIndex) => {
    const parsedBucket = toObject(bucket);
    if (!parsedBucket) return groups;

    for (const [bucketKey, bucketValue] of Object.entries(parsedBucket)) {
      if (!Array.isArray(bucketValue) || bucketValue.length === 0) continue;

      const coverageEntries = bucketValue
        .map((entry) => toObject(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));

      coverageEntries.forEach((entry, entryIndex) => {
        const rows = toCoverageRows(entry);
        if (rows.length === 0) return;

        const lineOfBusinessName = normalizeText(entry.lineOfBusinessName);
        const titleBase = lineOfBusinessName ?? toReadableCoverageTitle(bucketKey);
        const title = coverageEntries.length > 1 ? `${titleBase} ${entryIndex + 1}` : titleBase;
        const databaseId = normalizeText(entry.databaseId);

        groups.push({
          id: databaseId ?? `${bucketKey}-${bucketIndex}-${entryIndex}`,
          title,
          rows,
        });
      });
    }

    return groups;
  }, []);
}

export async function fetchPolicyCoveragesByPolicyId(policyId: string): Promise<PolicyCoverageGroup[]> {
  const trimmedPolicyId = policyId.trim();
  if (!trimmedPolicyId) {
    throw new Error('Missing policy id for policy coverages lookup.');
  }

  const url = `${getPolicyCoveragesApiBaseUrl()}/get-coverages?policyId=${encodeURIComponent(trimmedPolicyId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: withApiKeyHeader({ Accept: 'application/json' }),
  });

  if (!response.ok) {
    throw new Error(`Policy coverages lookup failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return mapPolicyCoveragesPayload(payload);
}
