import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_AGENT_API_BASE_URL = 'http://localhost:3000';

export type InsuredAgentRecord = {
  databaseId: string;
  firstName: string | null;
  lastName: string | null;
  insuredDatabaseId: string | null;
  email: string | null;
  phone: string | null;
  cellPhone: string | null;
  active: boolean;
  primaryRole: string | null;
  agentType: string | null;
};

function getAgentApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_AGENT_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_POLICY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() ||
    DEFAULT_AGENT_API_BASE_URL
  );
}

function isInsuredAgentRecord(value: unknown): value is InsuredAgentRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as { databaseId?: unknown };
  return typeof record.databaseId === 'string';
}

export async function fetchInsuredAgentsByInsuredDatabaseId(
  insuredDatabaseId: string
): Promise<InsuredAgentRecord[]> {
  const trimmedId = insuredDatabaseId.trim();
  if (!trimmedId) {
    throw new Error('Missing insured database id for agent lookup.');
  }

  const url = `${getAgentApiBaseUrl()}/insuredAgents?insuredId=${encodeURIComponent(trimmedId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: withApiKeyHeader({ Accept: 'application/json' }),
  });

  if (!response.ok) {
    throw new Error(`Agent lookup failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected agent lookup response format.');
  }

  return payload.filter(isInsuredAgentRecord);
}
