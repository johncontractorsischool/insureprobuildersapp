import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { CslbLicense, buildCslbLicenseUrl, fetchCslbLicenseByInsuredId } from '@/services/cslb-api';
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

export type CompanyStatusChip = 'Active' | 'Current' | 'Inactive';

const HIDDEN_DISPLAY_VALUES = new Set([
  'n/a',
  'na',
  'none',
  'not provided',
  'not available',
  'null',
  'undefined',
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

function buildStatusChips(statusText: string): CompanyStatusChip[] {
  const normalized = normalizeForComparison(statusText);
  const chips: CompanyStatusChip[] = [];

  if (normalized.includes('inactive')) {
    chips.push('Inactive');
  } else if (normalized.includes('active')) {
    chips.push('Active');
  }

  if (normalized.includes('current')) {
    chips.push('Current');
  }

  return chips;
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
      } catch {
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

  const statusFallbackText =
    normalizeDisplayValue(cslbLicense?.status) || (customer?.active === false ? 'Inactive' : 'Active');
  const statusChips = useMemo(() => buildStatusChips(statusFallbackText), [statusFallbackText]);

  const companyExpiration = normalizeDisplayValue(cslbLicense?.expireDate);
  const dataCurrentAsOf = normalizeDisplayValue(cslbLicense?.dataCurrentAsOf);

  const summaryRows = useMemo(
    () =>
      toRows([
        { label: 'License #', value: companyLicenseNumber },
        { label: 'Status', value: statusFallbackText },
        { label: 'Expiration', value: companyExpiration },
      ]),
    [companyExpiration, companyLicenseNumber, statusFallbackText]
  );

  const businessName = normalizeDisplayValue(cslbLicense?.business.businessName);

  const businessRows = useMemo(
    () =>
      toRows([
        { label: 'DBA', value: cslbLicense?.business.dba },
        { label: 'Street', value: cslbLicense?.business.street },
        { label: 'City/State/ZIP', value: cslbLicense?.business.cityStateZip },
        { label: 'Phone', value: cslbLicense?.business.phone },
        { label: 'Entity', value: cslbLicense?.entity },
        { label: 'Issue date', value: cslbLicense?.issueDate },
        { label: 'Expiration', value: cslbLicense?.expireDate },
      ]),
    [
      cslbLicense?.business.cityStateZip,
      cslbLicense?.business.dba,
      cslbLicense?.business.phone,
      cslbLicense?.business.street,
      cslbLicense?.entity,
      cslbLicense?.expireDate,
      cslbLicense?.issueDate,
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
        { label: 'Effective', value: bond.effectiveDate },
        { label: 'Expiration', value: bond.expirationDate },
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
    () =>
      toRows([
        { label: 'Carrier', value: cslbLicense?.workersComp?.carrierName },
        { label: 'Policy #', value: cslbLicense?.workersComp?.policyNumber },
        { label: 'Effective', value: cslbLicense?.workersComp?.effectiveDate },
        { label: 'Expiration', value: cslbLicense?.workersComp?.expireDate },
      ]),
    [
      cslbLicense?.workersComp?.carrierName,
      cslbLicense?.workersComp?.effectiveDate,
      cslbLicense?.workersComp?.expireDate,
      cslbLicense?.workersComp?.policyNumber,
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
    summaryRows,
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
