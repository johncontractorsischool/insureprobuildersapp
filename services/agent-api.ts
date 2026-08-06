import { buildClientQuery, pbiaRequest } from '@/services/pbia-client';

export type InsuredAgentRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

function isAgent(value: unknown): value is InsuredAgentRecord {
  if (!value || typeof value !== 'object') return false;
  const agent = value as Partial<InsuredAgentRecord>;
  return typeof agent.id === 'string';
}

export async function fetchClientAgent(
  clientEmail: string,
  accountId: string
): Promise<InsuredAgentRecord | null> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) throw new Error('Missing PBIA account id for agent lookup.');

  const payload = await pbiaRequest<unknown>(
    `/client/agent${buildClientQuery({ accountId: normalizedAccountId })}`,
    { method: 'GET', clientEmail },
    'Unable to load the assigned agent from PBIA.'
  );

  if (payload === null) return null;
  if (!isAgent(payload)) throw new Error('Unexpected PBIA agent response format.');
  return payload;
}
