import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import {
  CslbLicense,
  CslbWorkersComp,
  buildCslbLicenseUrl,
  fetchCslbLicenseByInsuredId,
} from '@/services/cslb-api';
import { getPortalConfig } from '@/services/portal-config';

export type CompanyInfoRow = {
  label: string;
  value: string;
};

export type CompanyInfoGroup = {
  id: string;
  title: string;
  rows: CompanyInfoRow[];
};

export type CompanyStatusChip = 'Active' | 'Needs Attention';

const HIDDEN_DISPLAY_VALUES = new Set([
  'n/a',
  'na',
  'none',
  'not provided',
  'not available',
  'null',
  'undefined',
]);

const LLC_PATTERNS = [
  /\bl\.?\s*l\.?\s*c\.?\b/i,
  /limited liability company/i,
  /limited liability co/i,
  /ltd liability/i,
] as const;

const POSITIVE_LICENSE_STATUS_TOKENS = ['active', 'current'] as const;
const NEGATIVE_LICENSE_STATUS_TOKENS = [
  'inactive',
  'expired',
  'suspend',
  'revoked',
  'cancel',
  'denied',
  'delinquent',
  'attention',
  'pending',
  'complaint',
] as const;

const WORKERS_COMP_EXEMPT_PATTERNS = [
  /exempt/i,
  /no employees?/i,
  /self[- ]insured/i,
  /not required/i,
  /waiv/i,
] as const;

const GENERIC_WORKERS_COMP_EXEMPT_VALUES = new Set([
  'exempt',
  'workers compensation exempt',
  'workers comp exempt',
  'workers compensation exempted',
  'workers compensation exemption',
  'workers comp exemption',
  'workers compensation exception',
  'workers comp exception',
  'w/c exempt',
]);

function normalizeForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '')
    .trim();
}

function normalizeDisplayValue(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (HIDDEN_DISPLAY_VALUES.has(normalizeForComparison(normalized))) {
    return null;
  }
  return normalized;
}

function toRows(entries: Array<{ label: string; value: string | null | undefined }>) {
  return entries.reduce<CompanyInfoRow[]>((rows, entry) => {
    const value = normalizeDisplayValue(entry.value);
    if (!value) return rows;

    rows.push({
      label: entry.label,
      value,
    });
    return rows;
  }, []);
}

function toDisplayStatus(statusText: string | null | undefined, isCustomerActive: boolean | undefined) {
  const normalizedStatus = normalizeDisplayValue(statusText);
  if (!normalizedStatus) {
    return isCustomerActive === false ? 'Needs Attention' : 'Active';
  }

  const normalized = normalizeForComparison(normalizedStatus);
  const hasPositiveToken = POSITIVE_LICENSE_STATUS_TOKENS.some((token) => normalized.includes(token));
  const hasNegativeToken = NEGATIVE_LICENSE_STATUS_TOKENS.some((token) => normalized.includes(token));

  if (hasPositiveToken && !hasNegativeToken) {
    return 'Active';
  }

  return 'Needs Attention';
}

function buildStatusChips(statusText: CompanyStatusChip): CompanyStatusChip[] {
  return [statusText];
}

function formatEntityDisplay(value: string | null | undefined) {
  const normalized = normalizeDisplayValue(value);
  if (!normalized) return null;

  if (LLC_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'LLC';
  }

  return normalized;
}

function hasWorkersCompExemptIndicator(value: string | null | undefined) {
  const normalized = normalizeDisplayValue(value);
  if (!normalized) return false;
  return WORKERS_COMP_EXEMPT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function toWorkersCompExemptDetail(value: string | null | undefined) {
  const normalized = normalizeDisplayValue(value);
  if (!normalized) return null;

  const comparisonValue = normalizeForComparison(normalized);
  const isGenericExemptLabel =
    GENERIC_WORKERS_COMP_EXEMPT_VALUES.has(comparisonValue) ||
    (comparisonValue.includes('exempt') &&
      (comparisonValue.includes('worker') ||
        comparisonValue.includes('workmen') ||
        comparisonValue.includes('w/c') ||
        comparisonValue.includes('comp')));

  if (isGenericExemptLabel) {
    return null;
  }

  if (comparisonValue.includes('no employees')) {
    return 'No employees reported';
  }

  if (comparisonValue.includes('self insured') || comparisonValue.includes('self-insured')) {
    return 'Self-insured';
  }

  return normalized;
}

function buildWorkersCompRows(workersComp: CslbWorkersComp | null) {
  if (!workersComp) return [];

  const exemptDetailSources = [
    workersComp.exemption,
    workersComp.exception,
    workersComp.notes,
    workersComp.status,
    workersComp.policyNumber,
    workersComp.carrierName,
  ];
  const isExempt = exemptDetailSources.some((value) => hasWorkersCompExemptIndicator(value));

  if (isExempt) {
    const detail =
      exemptDetailSources
        .map((value) => toWorkersCompExemptDetail(value))
        .find((value): value is string => Boolean(value)) ?? null;

    return toRows([
      { label: 'Status', value: 'Exempt' },
      { label: 'Details', value: detail },
    ]);
  }

  return toRows([
    { label: 'Carrier', value: workersComp.carrierName },
    { label: 'Policy #', value: workersComp.policyNumber },
    { label: 'Effective Date', value: workersComp.effectiveDate },
    { label: 'Expiration Date', value: workersComp.expireDate },
  ]);
}

export function useCompanyProfile() {
  const { customer } = useAuth();
  const portalConfig = useMemo(() => getPortalConfig(), []);
  const [cslbLicense, setCslbLicense] = useState<CslbLicense | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [companyLookupNotice, setCompanyLookupNotice] = useState<string | null>(null);

  const cslbInsuredId = useMemo(() => customer?.insuredId?.trim() || '', [customer?.insuredId]);

  useEffect(() => {
    let isMounted = true;

    const hydrateCompany = async () => {
      if (!cslbInsuredId) {
        setCslbLicense(null);
        setCompanyLookupNotice('No CSLB license number is available for this account.');
        setIsLoadingCompany(false);
        return;
      }

      setIsLoadingCompany(true);
      setCompanyLookupNotice(null);

      try {
        const nextLicense = await fetchCslbLicenseByInsuredId(cslbInsuredId);
        if (!isMounted) return;
        setCslbLicense(nextLicense);
      } catch (error) {
        console.warn('[Company Profile] CSLB lookup failed.', {
          insuredId: cslbInsuredId,
          error: error instanceof Error ? error.message : 'Unknown company lookup error',
        });
        if (!isMounted) return;
        setCslbLicense(null);
        setCompanyLookupNotice('Unable to load CSLB details right now. You can still open the CSLB website.');
      } finally {
        if (isMounted) {
          setIsLoadingCompany(false);
        }
      }
    };

    void hydrateCompany();

    return () => {
      isMounted = false;
    };
  }, [cslbInsuredId]);

  const cslbLink = useMemo(() => {
    if (cslbInsuredId) return buildCslbLicenseUrl(cslbInsuredId);
    return cslbLicense?.sourceUrl ?? portalConfig.company.cslbUrl;
  }, [cslbInsuredId, cslbLicense?.sourceUrl, portalConfig.company.cslbUrl]);

  const companyLicenseNumber =
    normalizeDisplayValue(cslbLicense?.licenseNumber) ||
    normalizeDisplayValue(cslbInsuredId) ||
    normalizeDisplayValue(portalConfig.company.licenseNumber);

  const statusFallbackText = toDisplayStatus(cslbLicense?.status, customer?.active);
  const statusChips = useMemo(() => buildStatusChips(statusFallbackText), [statusFallbackText]);

  const companyEffectiveDate = normalizeDisplayValue(cslbLicense?.issueDate);
  const companyExpirationDate = normalizeDisplayValue(cslbLicense?.expireDate);
  const dataCurrentAsOf = normalizeDisplayValue(cslbLicense?.dataCurrentAsOf);

  const licenseRows = useMemo(
    () =>
      toRows([
        { label: 'License #', value: companyLicenseNumber },
        { label: 'Status', value: statusFallbackText },
        { label: 'Effective Date', value: companyEffectiveDate },
        { label: 'Expiration Date', value: companyExpirationDate },
        { label: 'Data Current', value: dataCurrentAsOf },
      ]),
    [companyEffectiveDate, companyExpirationDate, companyLicenseNumber, dataCurrentAsOf, statusFallbackText]
  );

  const businessName = normalizeDisplayValue(cslbLicense?.business.businessName);

  const businessRows = useMemo(
    () =>
      toRows([
        { label: 'DBA', value: cslbLicense?.business.dba },
        { label: 'Street', value: cslbLicense?.business.street },
        { label: 'City/State/ZIP', value: cslbLicense?.business.cityStateZip },
        { label: 'Phone', value: cslbLicense?.business.phone },
        { label: 'Entity', value: formatEntityDisplay(cslbLicense?.entity) },
      ]),
    [
      cslbLicense?.business.cityStateZip,
      cslbLicense?.business.dba,
      cslbLicense?.business.phone,
      cslbLicense?.business.street,
      cslbLicense?.entity,
    ]
  );

  const classifications = useMemo(
    () =>
      (cslbLicense?.classifications ?? [])
        .map((classification) => normalizeDisplayValue(classification))
        .filter((classification): classification is string => Boolean(classification)),
    [cslbLicense?.classifications]
  );

  const bonding = useMemo(() => {
    return (cslbLicense?.bonding ?? []).reduce<CompanyInfoGroup[]>((groups, bond, index) => {
      const rows = toRows([
        { label: 'Carrier', value: bond.carrierName },
        { label: 'Bond #', value: bond.bondNumber },
        { label: 'Amount', value: bond.bondAmount },
        { label: 'Effective Date', value: bond.effectiveDate },
        { label: 'Expiration Date', value: bond.expirationDate },
      ]);

      if (rows.length === 0) return groups;

      const type = normalizeDisplayValue(bond.bondType) || `Bond ${index + 1}`;
      groups.push({
        id: `${bond.bondNumber ?? 'bond'}-${index}`,
        title: type,
        rows,
      });

      return groups;
    }, []);
  }, [cslbLicense?.bonding]);

  const workersCompRows = useMemo(
    () => buildWorkersCompRows(cslbLicense?.workersComp ?? null),
    [
      cslbLicense?.workersComp?.carrierName,
      cslbLicense?.workersComp?.effectiveDate,
      cslbLicense?.workersComp?.exception,
      cslbLicense?.workersComp?.exemption,
      cslbLicense?.workersComp?.expireDate,
      cslbLicense?.workersComp?.notes,
      cslbLicense?.workersComp?.policyNumber,
      cslbLicense?.workersComp?.status,
    ]
  );

  const personnel = useMemo(() => {
    return (cslbLicense?.personnel ?? []).reduce<CompanyInfoGroup[]>((groups, member, index) => {
      const rows = toRows([
        { label: 'Title', value: member.title },
        { label: 'Associated', value: member.associationDate },
        { label: 'Classification', value: member.classification },
      ]);
      const memberName = normalizeDisplayValue(member.name);

      if (!memberName && rows.length === 0) return groups;

      groups.push({
        id: `${member.name ?? 'person'}-${index}`,
        title: memberName ?? `Personnel ${index + 1}`,
        rows,
      });

      return groups;
    }, []);
  }, [cslbLicense?.personnel]);

  const hasDetailContent =
    licenseRows.length > 0 ||
    Boolean(businessName) ||
    businessRows.length > 0 ||
    classifications.length > 0 ||
    bonding.length > 0 ||
    workersCompRows.length > 0 ||
    personnel.length > 0;

  return {
    isLoadingCompany,
    companyLookupNotice,
    cslbLink,
    cslbLicense,
    licenseRows,
    statusChips,
    statusFallbackText,
    dataCurrentAsOf,
    businessName,
    businessRows,
    classifications,
    bonding,
    workersCompRows,
    personnel,
    hasDetailContent,
  };
}
