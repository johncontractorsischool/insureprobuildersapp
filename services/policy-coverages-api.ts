import { buildClientQuery, pbiaRequest } from '@/services/pbia-client';

export type PolicyCoverageRow = {
  label: string;
  value: string;
};

export type PolicyCoverageGroup = {
  id: string;
  title: string;
  rows: PolicyCoverageRow[];
};

type ClientCoverageRecord = {
  id: string;
  name: string;
  limitAmount: number | null;
  premium: number | null;
  coverageCode: string | null;
};

type ClientCoverageList = {
  data: ClientCoverageRecord[];
  total: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function isCoverage(value: unknown): value is ClientCoverageRecord {
  if (!value || typeof value !== 'object') return false;
  const coverage = value as Partial<ClientCoverageRecord>;
  return typeof coverage.id === 'string' && typeof coverage.name === 'string';
}

export async function fetchPolicyCoverages(
  clientEmail: string,
  accountId: string,
  policyId: string
): Promise<PolicyCoverageGroup[]> {
  const normalizedAccountId = accountId.trim();
  const normalizedPolicyId = policyId.trim();
  if (!normalizedAccountId || !normalizedPolicyId) {
    throw new Error('Missing PBIA account id or policy id for coverage lookup.');
  }

  const payload = await pbiaRequest<ClientCoverageList>(
    `/client/policies/${encodeURIComponent(normalizedPolicyId)}/coverages${buildClientQuery({
      accountId: normalizedAccountId,
    })}`,
    { method: 'GET', clientEmail },
    'Unable to load policy coverages from PBIA.'
  );

  if (!payload || !Array.isArray(payload.data) || !payload.data.every(isCoverage)) {
    throw new Error('Unexpected PBIA coverage response format.');
  }

  return payload.data.map((coverage) => {
    const rows: PolicyCoverageRow[] = [];
    if (coverage.coverageCode?.trim()) rows.push({ label: 'Coverage Code', value: coverage.coverageCode.trim() });
    if (typeof coverage.limitAmount === 'number') rows.push({ label: 'Limit', value: formatCurrency(coverage.limitAmount) });
    if (typeof coverage.premium === 'number') rows.push({ label: 'Premium', value: formatCurrency(coverage.premium) });
    return { id: coverage.id, title: coverage.name, rows };
  });
}
