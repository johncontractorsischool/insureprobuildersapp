import { buildClientQuery, pbiaRequest } from '@/services/pbia-client';
import type { Policy, PolicyStatus } from '@/types/policy';

type ClientPolicyRecord = {
  id: string;
  accountId: string;
  accountName: string;
  policyNumber: string | null;
  recordType: 'POLICY' | 'QUOTE';
  status: string;
  lineOfBusiness: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  carrierReference: string | null;
  premium: number | null;
};

type ClientPolicyList = {
  data: ClientPolicyRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toDisplayLabel(value: string | null | undefined, fallback: string) {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  return normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

function toPolicyStatus(record: ClientPolicyRecord): PolicyStatus {
  const status = record.status.trim().toUpperCase();
  if (status === 'ACTIVE') return 'Active';
  if (record.recordType === 'QUOTE' || status === 'PENDING' || status === 'QUOTE') return 'Pending';
  return 'Lapsed';
}

function isClientPolicyRecord(value: unknown): value is ClientPolicyRecord {
  if (!value || typeof value !== 'object') return false;
  const policy = value as Partial<ClientPolicyRecord>;
  return (
    typeof policy.id === 'string' &&
    typeof policy.accountId === 'string' &&
    (policy.recordType === 'POLICY' || policy.recordType === 'QUOTE') &&
    typeof policy.status === 'string'
  );
}

function mapPolicyRecord(record: ClientPolicyRecord): Policy {
  const productName = toDisplayLabel(record.lineOfBusiness, 'Policy');
  const carrierName = normalizeText(record.carrierReference) ?? 'Carrier not provided';
  const effectiveDate = normalizeText(record.effectiveDate) ?? new Date(0).toISOString();
  const expirationDate = normalizeText(record.expirationDate) ?? effectiveDate;
  const premium = typeof record.premium === 'number' && Number.isFinite(record.premium) ? record.premium : 0;

  return {
    id: record.id,
    accountId: record.accountId,
    recordType: record.recordType,
    lineOfBusiness: record.lineOfBusiness,
    productName,
    status: toPolicyStatus(record),
    policyNumber: normalizeText(record.policyNumber) ?? record.id,
    carrierName,
    premium,
    premiumMonthly: premium,
    effectiveDate,
    expirationDate,
    insuredName: normalizeText(record.accountName) ?? 'Named insured',
    insuredItem: `${productName} • ${carrierName}`,
    coverageSummary: [
      { label: 'Line of business', value: productName },
      { label: 'Carrier', value: carrierName },
      { label: 'Effective date', value: formatPolicyDate(effectiveDate) },
      { label: 'Expiration date', value: formatPolicyDate(expirationDate) },
    ],
    billing: {
      plan: 'Billing details available in Payments',
      monthlyPremium: premium,
      nextDueDate: expirationDate,
      lastPaymentDate: 'Not available',
      autopayEnabled: false,
    },
    documents: [],
    claimsPlaceholder: `Current status: ${record.status}. Claims integration is coming soon.`,
  };
}

export async function fetchPoliciesByAccount(
  clientEmail: string,
  accountId: string
): Promise<Policy[]> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) throw new Error('Missing PBIA account id for policy lookup.');

  const loadPage = (page: number) =>
    pbiaRequest<ClientPolicyList>(
      `/client/policies${buildClientQuery({ accountId: normalizedAccountId, page, pageSize: 50 })}`,
      { method: 'GET', clientEmail },
      'Unable to load policies from PBIA.'
    );
  const payload = await loadPage(1);

  if (!payload || !Array.isArray(payload.data) || !payload.data.every(isClientPolicyRecord)) {
    throw new Error('Unexpected PBIA policy response format.');
  }

  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, payload.totalPages - 1) }, (_, index) => loadPage(index + 2))
  );
  const policies = [payload, ...remainingPages].flatMap((page) => page.data);
  if (!policies.every(isClientPolicyRecord)) {
    throw new Error('Unexpected PBIA policy response format.');
  }
  return policies.map(mapPolicyRecord);
}
