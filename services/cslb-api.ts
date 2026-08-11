import { buildClientQuery, pbiaRequest } from '@/services/pbia-client';

const CSLB_LICENSE_SITE_BASE_URL =
  'https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=';

export type CslbBond = {
  bondType: string | null;
  carrierName: string | null;
  bondNumber: string | null;
  bondAmount: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
};

export type CslbWorkersComp = {
  carrierName: string | null;
  policyNumber: string | null;
  effectiveDate: string | null;
  expireDate: string | null;
  status: string | null;
  exemption: string | null;
  exception: string | null;
  notes: string | null;
};

export type CslbPersonnel = {
  name: string | null;
  title: string | null;
  associationDate: string | null;
  classification: string | null;
};

export type CslbBusiness = {
  businessName: string | null;
  dba: string | null;
  street: string | null;
  cityStateZip: string | null;
  phone: string | null;
};

export type CslbLicense = {
  recordType?: 'LICENSE' | 'APPLICATION_FEE';
  sourceUrl: string;
  licenseNumber: string;
  dataCurrentAsOf: string | null;
  business: CslbBusiness;
  entity: string | null;
  issueDate: string | null;
  expireDate: string | null;
  status: string | null;
  classifications: string[];
  bonding: CslbBond[];
  workersComp: CslbWorkersComp | null;
  liability: Record<string, unknown> | null;
  personnel: CslbPersonnel[];
};

type ClientCslbSummary = {
  sourceUrl: string;
  licenseNumber: string;
  dataCurrentAsOf: string | null;
  status: string | null;
  issueDate: string | null;
  expireDate: string | null;
  classifications: string[];
};

type ClientCslbResponse = {
  recordType: 'LICENSE' | 'APPLICATION_FEE';
  number: string;
  sourceUrl: string;
  summary: ClientCslbSummary | null;
};

export function buildCslbLicenseUrl(licenseNumber: string) {
  const trimmed = licenseNumber.trim();
  if (!trimmed) return null;
  return `${CSLB_LICENSE_SITE_BASE_URL}${encodeURIComponent(trimmed)}`;
}

function mapClientCslb(payload: ClientCslbResponse): CslbLicense {
  if (
    !payload ||
    (payload.recordType !== 'LICENSE' && payload.recordType !== 'APPLICATION_FEE') ||
    typeof payload.number !== 'string' ||
    typeof payload.sourceUrl !== 'string'
  ) {
    throw new Error('Unexpected PBIA CSLB response format.');
  }

  const summary = payload.summary;
  return {
    recordType: payload.recordType,
    sourceUrl: summary?.sourceUrl ?? payload.sourceUrl,
    licenseNumber: summary?.licenseNumber ?? payload.number,
    dataCurrentAsOf: summary?.dataCurrentAsOf ?? null,
    business: {
      businessName: null,
      dba: null,
      street: null,
      cityStateZip: null,
      phone: null,
    },
    entity: null,
    issueDate: summary?.issueDate ?? null,
    expireDate: summary?.expireDate ?? null,
    status: summary?.status ?? (payload.recordType === 'APPLICATION_FEE' ? 'Application pending' : null),
    classifications: Array.isArray(summary?.classifications) ? summary.classifications : [],
    bonding: [],
    workersComp: null,
    liability: null,
    personnel: [],
  };
}

async function requestCslb(clientEmail: string, accountId: string, refresh: boolean) {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) throw new Error('Missing PBIA account id for CSLB lookup.');

  const payload = refresh
    ? await pbiaRequest<ClientCslbResponse>(
        '/client/cslb/refresh',
        {
          method: 'POST',
          clientEmail,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: normalizedAccountId }),
        },
        'Unable to refresh CSLB details through PBIA.'
      )
    : await pbiaRequest<ClientCslbResponse>(
        `/client/cslb${buildClientQuery({ accountId: normalizedAccountId })}`,
        { method: 'GET', clientEmail },
        'Unable to load CSLB details through PBIA.'
      );

  return mapClientCslb(payload);
}

export function fetchClientCslb(clientEmail: string, accountId: string) {
  return requestCslb(clientEmail, accountId, false);
}

export function refreshClientCslb(clientEmail: string, accountId: string) {
  return requestCslb(clientEmail, accountId, true);
}
