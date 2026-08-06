import { buildClientQuery, PbiaApiError, pbiaRequest } from '@/services/pbia-client';
import type { CustomerLookupRecord } from '@/types/customer';

type ClientAgentRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

type ClientAccountRecord = {
  id: string;
  legalName: string;
  dba: string | null;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  status: string;
  entityType: string | null;
  agentId: string | null;
  agent: ClientAgentRecord | null;
  policyCount: number;
};

type ClientAccountList = {
  data: ClientAccountRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function isClientAccountRecord(value: unknown): value is ClientAccountRecord {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<ClientAccountRecord>;
  return (
    typeof account.id === 'string' &&
    typeof account.legalName === 'string' &&
    typeof account.status === 'string' &&
    typeof account.policyCount === 'number'
  );
}

function toCustomerLookupRecord(account: ClientAccountRecord): CustomerLookupRecord {
  const commercialName = account.dba?.trim() || account.legalName;
  const active = account.status.toUpperCase() === 'ACTIVE';

  return {
    accountId: account.id,
    legalName: account.legalName,
    dba: account.dba,
    email: account.email,
    licenseNumber: account.licenseNumber,
    status: account.status,
    entityType: account.entityType,
    agentId: account.agentId,
    policyCount: account.policyCount,
    // Compatibility aliases keep persisted portal profiles readable during migration.
    databaseId: account.id,
    commercialName,
    firstName: null,
    lastName: null,
    type: null,
    addressLine1: null,
    addressLine2: null,
    stateNameOrAbbreviation: null,
    city: null,
    zipCode: null,
    eMail: account.email,
    eMail2: null,
    eMail3: null,
    fax: null,
    phone: account.phone,
    cellPhone: null,
    smsPhone: null,
    description: null,
    active,
    website: null,
    fein: null,
    customerId: account.id,
    insuredId: account.licenseNumber,
  };
}

export async function fetchCustomersByEmail(email: string): Promise<CustomerLookupRecord[]> {
  const loadPage = (page: number) =>
    pbiaRequest<ClientAccountList>(
      `/client/account${buildClientQuery({ page, pageSize: 50 })}`,
      { method: 'GET', clientEmail: email },
      'We could not load your PBIA account right now.'
    );
  const payload = await loadPage(1);

  if (!payload || !Array.isArray(payload.data) || !payload.data.every(isClientAccountRecord)) {
    throw new Error('Unexpected PBIA account response format.');
  }

  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, payload.totalPages - 1) }, (_, index) => loadPage(index + 2))
  );
  const accounts = [payload, ...remainingPages].flatMap((page) => page.data);
  if (!accounts.every(isClientAccountRecord)) {
    throw new Error('Unexpected PBIA account response format.');
  }
  return accounts.map(toCustomerLookupRecord);
}

export async function fetchAccountByBusinessEmail(email: string): Promise<CustomerLookupRecord | null> {
  try {
    const account = await pbiaRequest<ClientAccountRecord>(
      '/client/account/by-business-email',
      { method: 'GET', clientEmail: email },
      'We could not find your PBIA account right now.'
    );

    if (!isClientAccountRecord(account)) {
      throw new Error('Unexpected PBIA account response format.');
    }

    return toCustomerLookupRecord(account);
  } catch (error) {
    if (error instanceof PbiaApiError && error.status === 404) return null;
    throw error;
  }
}

export type { ClientAccountRecord, ClientAgentRecord };
