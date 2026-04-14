import { renderHook, waitFor } from '@testing-library/react-native';

import { useCompanyProfile } from '@/hooks/use-company-profile';
import { buildCustomer } from '@/tests/factories';

const mockUseAuth = jest.fn();
const mockFetchCslbLicenseByInsuredId = jest.fn();
const mockGetPortalConfig = jest.fn();

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/cslb-api', () => {
  const actual = jest.requireActual('@/services/cslb-api');
  return {
    ...actual,
    fetchCslbLicenseByInsuredId: (...args: unknown[]) => mockFetchCslbLicenseByInsuredId(...args),
  };
});

jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => mockGetPortalConfig(),
}));

describe('useCompanyProfile', () => {
  beforeEach(() => {
    mockGetPortalConfig.mockReturnValue({
      agent: {
        name: 'Fallback Agent',
        phone: null,
        email: null,
        smsPhone: null,
        scheduleUrl: null,
      },
      company: {
        licenseNumber: 'LIC-123456',
        cslbUrl: 'https://cslb.ca.gov/license',
      },
      actions: {
        intakeFormsUrl: null,
        issueCoiUrl: null,
      },
    });
  });

  it('maps CSLB license content into dashboard-ready rows and chips', async () => {
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({ insuredId: 'LIC-123456', active: true }),
    });
    mockFetchCslbLicenseByInsuredId.mockResolvedValue({
      sourceUrl: 'https://cslb.ca.gov/license-detail',
      licenseNumber: 'LIC-123456',
      dataCurrentAsOf: 'Mar 1, 2026',
      business: {
        businessName: 'Builder Co',
        dba: 'Builder DBA',
        street: '123 Main St',
        cityStateZip: 'Los Angeles, CA 90001',
        phone: '5551112222',
      },
      entity: 'Corporation',
      issueDate: 'Jan 1, 2020',
      expireDate: 'Jan 1, 2027',
      status: 'Active and current',
      classifications: ['B - General Building Contractor'],
      bonding: [
        {
          bondType: 'Contractor Bond',
          carrierName: 'Surety Co',
          bondNumber: 'B123',
          bondAmount: '$25,000',
          effectiveDate: 'Jan 1, 2026',
          expirationDate: 'Jan 1, 2027',
        },
      ],
      workersComp: {
        carrierName: 'WC Carrier',
        policyNumber: 'WC123',
        effectiveDate: 'Jan 1, 2026',
        expireDate: 'Jan 1, 2027',
      },
      liability: null,
      personnel: [
        {
          name: 'Jane Builder',
          title: 'Officer',
          associationDate: 'Jan 1, 2020',
          classification: 'Responsible Managing Officer',
        },
      ],
    });

    const { result } = renderHook(() => useCompanyProfile());

    await waitFor(() => expect(result.current.isLoadingCompany).toBe(false));

    expect(mockFetchCslbLicenseByInsuredId).toHaveBeenCalledWith('LIC-123456');
    expect(result.current.statusChips).toEqual(['Active']);
    expect(result.current.summaryRows).toEqual(
      expect.arrayContaining([
        { label: 'License #', value: 'LIC-123456' },
        { label: 'Effective Date', value: 'Jan 1, 2020' },
        { label: 'Expiration Date', value: 'Jan 1, 2027' },
      ])
    );
    expect(result.current.businessName).toBe('Builder Co');
    expect(result.current.classifications).toEqual(['B - General Building Contractor']);
    expect(result.current.bonding).toHaveLength(1);
    expect(result.current.personnel).toHaveLength(1);
    expect(result.current.hasDetailContent).toBe(true);
  });

  it('falls back to configured values when no insured id is available', async () => {
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({ insuredId: '', active: false }),
    });

    const { result } = renderHook(() => useCompanyProfile());

    await waitFor(() => expect(result.current.isLoadingCompany).toBe(false));

    expect(mockFetchCslbLicenseByInsuredId).not.toHaveBeenCalled();
    expect(result.current.companyLookupNotice).toBe('No CSLB license number is available for this account.');
    expect(result.current.cslbLink).toBe('https://cslb.ca.gov/license');
    expect(result.current.statusFallbackText).toBe('Needs Attention');
  });

  it('normalizes LLC entity values and exempt workers compensation details', async () => {
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({ insuredId: 'LIC-654321', active: true }),
    });
    mockFetchCslbLicenseByInsuredId.mockResolvedValue({
      sourceUrl: 'https://cslb.ca.gov/license-detail',
      licenseNumber: 'LIC-654321',
      dataCurrentAsOf: 'Apr 14, 2026',
      business: {
        businessName: 'LLC Builder Co',
        dba: null,
        street: '456 Market St',
        cityStateZip: 'Irvine, CA 92618',
        phone: '5551110000',
      },
      entity: 'Limited Liability Company',
      issueDate: 'Jan 1, 2022',
      expireDate: 'Jan 1, 2027',
      status: 'Suspended',
      classifications: [],
      bonding: [],
      workersComp: {
        carrierName: 'Workers Compensation Exempt',
        policyNumber: 'Exempt',
        effectiveDate: null,
        expireDate: null,
        status: 'Exempt',
        exemption: 'No employees',
        exception: null,
        notes: null,
      },
      liability: null,
      personnel: [],
    });

    const { result } = renderHook(() => useCompanyProfile());

    await waitFor(() => expect(result.current.isLoadingCompany).toBe(false));

    expect(result.current.statusChips).toEqual(['Needs Attention']);
    expect(result.current.businessRows).toEqual(
      expect.arrayContaining([
        { label: 'Entity', value: 'LLC' },
        { label: 'Effective Date', value: 'Jan 1, 2022' },
        { label: 'Expiration Date', value: 'Jan 1, 2027' },
      ])
    );
    expect(result.current.workersCompRows).toEqual([
      { label: 'Status', value: 'Exempt' },
      { label: 'Details', value: 'No employees reported' },
    ]);
  });
});
