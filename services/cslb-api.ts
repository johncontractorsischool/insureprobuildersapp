import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_CSLB_API_BASE_URL = 'http://localhost:3000';
const CSLB_LICENSE_SITE_BASE_URL = 'https://www.cslb.ca.gov';

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

function getCslbApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_CSLB_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_POLICY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() ||
    DEFAULT_CSLB_API_BASE_URL
  );
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapBusiness(value: unknown): CslbBusiness {
  const payload = toObject(value);
  if (!payload) {
    return {
      businessName: null,
      dba: null,
      street: null,
      cityStateZip: null,
      phone: null,
    };
  }

  return {
    businessName: normalizeText(payload.businessName),
    dba: normalizeText(payload.dba),
    street: normalizeText(payload.street),
    cityStateZip: normalizeText(payload.cityStateZip),
    phone: normalizeText(payload.phone),
  };
}

function mapBond(value: unknown): CslbBond | null {
  const payload = toObject(value);
  if (!payload) return null;

  return {
    bondType: normalizeText(payload.bondType),
    carrierName: normalizeText(payload.carrierName),
    bondNumber: normalizeText(payload.bondNumber),
    bondAmount: normalizeText(payload.bondAmount),
    effectiveDate: normalizeText(payload.effectiveDate),
    expirationDate: normalizeText(payload.expirationDate),
  };
}

function mapWorkersComp(value: unknown): CslbWorkersComp | null {
  const payload = toObject(value);
  if (!payload) return null;

  return {
    carrierName: normalizeText(payload.carrierName),
    policyNumber: normalizeText(payload.policyNumber),
    effectiveDate: normalizeText(payload.effectiveDate),
    expireDate: normalizeText(payload.expireDate),
    status: normalizeText(payload.status),
    exemption: normalizeText(payload.exemption),
    exception: normalizeText(payload.exception),
    notes: normalizeText(payload.notes),
  };
}

function mapPersonnel(value: unknown): CslbPersonnel | null {
  const payload = toObject(value);
  if (!payload) return null;

  return {
    name: normalizeText(payload.name),
    title: normalizeText(payload.title),
    associationDate: normalizeText(payload.associationDate),
    classification: normalizeText(payload.classification),
  };
}

export function buildCslbLicenseUrl(licenseNumber: string) {
  const trimmed = licenseNumber.trim();
  if (!trimmed) return null;
  return `${CSLB_LICENSE_SITE_BASE_URL}/${encodeURIComponent(trimmed)}`;
}

function mapCslbPayload(payload: unknown, insuredId: string): CslbLicense {
  const parsed = toObject(payload);
  if (!parsed) {
    throw new Error('Unexpected CSLB response format.');
  }

  const sourceUrl = normalizeText(parsed.sourceUrl) ?? buildCslbLicenseUrl(insuredId);
  const licenseNumber = normalizeText(parsed.licenseNumber) ?? insuredId;
  const classifications = Array.isArray(parsed.classifications)
    ? parsed.classifications
        .map((entry) => normalizeText(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const bonding = Array.isArray(parsed.bonding)
    ? parsed.bonding.map((entry) => mapBond(entry)).filter((entry): entry is CslbBond => Boolean(entry))
    : [];
  const personnel = Array.isArray(parsed.personnel)
    ? parsed.personnel
        .map((entry) => mapPersonnel(entry))
        .filter((entry): entry is CslbPersonnel => Boolean(entry))
    : [];

  if (!sourceUrl) {
    throw new Error('Missing CSLB source URL.');
  }

  return {
    sourceUrl,
    licenseNumber,
    dataCurrentAsOf: normalizeText(parsed.dataCurrentAsOf),
    business: mapBusiness(parsed.business),
    entity: normalizeText(parsed.entity),
    issueDate: normalizeText(parsed.issueDate),
    expireDate: normalizeText(parsed.expireDate),
    status: normalizeText(parsed.status),
    classifications,
    bonding,
    workersComp: mapWorkersComp(parsed.workersComp),
    liability: toObject(parsed.liability),
    personnel,
  };
}

export async function fetchCslbLicenseByInsuredId(insuredId: string): Promise<CslbLicense> {
  const trimmedId = insuredId.trim();
  if (!trimmedId) {
    throw new Error('Missing insured id for CSLB lookup.');
  }

  const url = `${getCslbApiBaseUrl()}/cslb/${encodeURIComponent(trimmedId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: withApiKeyHeader({ Accept: 'application/json' }),
  });

  if (!response.ok) {
    throw new Error(`CSLB lookup failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return mapCslbPayload(payload, trimmedId);
}
