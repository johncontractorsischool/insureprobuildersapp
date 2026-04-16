import { Policy, PolicyStatus } from '@/types/policy';
import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_POLICY_API_BASE_URL = 'http://localhost:3000';

type PolicyLookupRecord = {
  databaseId: string;
  number: string | null;
  isQuote: boolean | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  insuredFirstName: string | null;
  insuredLastName: string | null;
  insuredCommercialName: string | null;
  linesOfBusiness: string[] | null;
  carrierName: string | null;
  totalPremium: number | null;
  changeDate: string | null;
  active: boolean;
  status: string | null;
  inceptionDate: string | null;
  createDate: string | null;
  billingType: number | null;
};

function getPolicyApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_POLICY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() ||
    DEFAULT_POLICY_API_BASE_URL
  );
}

function normalizeText(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function formatPolicyDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function normalizeCurrencyValue(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value;
}

function toPolicyStatus(record: PolicyLookupRecord): PolicyStatus {
  const rawStatus = normalizeText(record.status)?.toLowerCase();

  if (record.active || rawStatus === 'active') return 'Active';
  if (record.isQuote || rawStatus === 'pending' || rawStatus === 'quote' || rawStatus === 'quoted') {
    return 'Pending';
  }

  return 'Lapsed';
}

function toBillingPlan(record: PolicyLookupRecord) {
  if (record.billingType === 0) return 'Agency billed';
  if (record.billingType === 1) return 'Carrier billed';
  return 'Billing details unavailable';
}

function isPolicyLookupRecord(value: unknown): value is PolicyLookupRecord {
  if (!value || typeof value !== 'object') return false;
  const maybeRecord = value as { databaseId?: unknown };
  return typeof maybeRecord.databaseId === 'string';
}

function extractPolicyRecords(payload: unknown): PolicyLookupRecord[] | null {
  if (Array.isArray(payload)) {
    return payload.filter(isPolicyLookupRecord);
  }

  if (!payload || typeof payload !== 'object') return null;

  const maybeWrapped = payload as { data?: unknown };
  if (Array.isArray(maybeWrapped.data)) {
    return maybeWrapped.data.filter(isPolicyLookupRecord);
  }

  return null;
}

function mapPolicyRecord(record: PolicyLookupRecord): Policy {
  const lineOfBusinessValues = (record.linesOfBusiness ?? [])
    .map((entry) => normalizeText(entry))
    .filter((entry): entry is string => Boolean(entry));
  const lineOfBusiness = lineOfBusinessValues.length > 0 ? lineOfBusinessValues.join(', ') : 'Policy';
  const carrierName = normalizeText(record.carrierName) ?? 'Carrier not provided';

  const effectiveDate =
    normalizeText(record.effectiveDate) ??
    normalizeText(record.inceptionDate) ??
    normalizeText(record.createDate) ??
    new Date().toISOString();
  const expirationDate = normalizeText(record.expirationDate) ?? effectiveDate;

  const personalName = [normalizeText(record.insuredFirstName), normalizeText(record.insuredLastName)]
    .filter((entry): entry is string => Boolean(entry))
    .join(' ');
  const insuredName = normalizeText(record.insuredCommercialName) ?? (personalName || 'Named insured');

  const statusValue = normalizeText(record.status) ?? (record.active ? 'Active' : 'Inactive');
  const monthlyPremium = normalizeCurrencyValue(record.totalPremium);
  const lastPaymentDate = normalizeText(record.changeDate) ?? 'Not billed yet';

  return {
    id: record.databaseId,
    productName: lineOfBusiness,
    status: toPolicyStatus(record),
    policyNumber: normalizeText(record.number) ?? record.databaseId,
    carrierName,
    premiumMonthly: monthlyPremium,
    effectiveDate,
    expirationDate,
    insuredName,
    insuredItem: `${lineOfBusiness} • ${carrierName}`,
    coverageSummary: [
      { label: 'Line of business', value: lineOfBusiness },
      { label: 'Carrier', value: carrierName },
      { label: 'Effective date', value: formatPolicyDate(effectiveDate) },
      { label: 'Expiration date', value: formatPolicyDate(expirationDate) },
    ],
    billing: {
      plan: toBillingPlan(record),
      monthlyPremium,
      nextDueDate: expirationDate,
      lastPaymentDate,
      autopayEnabled: false,
    },
    documents: [],
    claimsPlaceholder: `Current status: ${statusValue}. Claims integration is coming soon.`,
  };
}

export async function fetchPoliciesByInsuredDatabaseId(insuredDatabaseId: string): Promise<Policy[]> {
  const trimmedId = insuredDatabaseId.trim();
  if (!trimmedId) {
    throw new Error('Missing insured database id for policy lookup.');
  }

  const url = `${getPolicyApiBaseUrl()}/getPolicy?IId=${encodeURIComponent(trimmedId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: withApiKeyHeader({ Accept: 'application/json' }),
  });

  if (!response.ok) {
    throw new Error(`Policy lookup failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  const records = extractPolicyRecords(payload);
  if (!records) {
    throw new Error('Unexpected policy lookup response format.');
  }

  const policies = records.map(mapPolicyRecord);
  return policies.sort((left, right) => right.expirationDate.localeCompare(left.expirationDate));
}
