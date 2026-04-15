import React from 'react';
import { render } from '@testing-library/react-native';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseCompanyProfile = jest.fn();
const mockOpenInAppBrowser = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
}));
jest.mock('@/hooks/use-company-profile', () => ({
  useCompanyProfile: () => mockUseCompanyProfile(),
}));
jest.mock('@/utils/external-actions', () => ({
  openInAppBrowser: (...args: unknown[]) => mockOpenInAppBrowser(...args),
}));

const CompanyDetailScreen = require('@/app/company/index').default;

describe('CompanyDetailScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseCompanyProfile.mockReturnValue({
      isLoadingCompany: false,
      companyLookupNotice: null,
      cslbLink: 'https://cslb.ca.gov/license-detail',
      licenseRows: [
        { label: 'License #', value: 'LIC-123456' },
        { label: 'Effective Date', value: 'Jan 1, 2020' },
      ],
      statusChips: ['Active'],
      statusFallbackText: 'Active',
      dataCurrentAsOf: 'Mar 1, 2026',
      businessName: 'Builder Co',
      businessRows: [
        { label: 'Entity', value: 'Corporation' },
        { label: 'Phone', value: '5551112222' },
      ],
      classifications: [],
      bonding: [],
      workersCompRows: [],
      personnel: [],
      hasDetailContent: true,
    });
    mockOpenInAppBrowser.mockResolvedValue({ ok: true });
  });

  it('renders separate license and business information sections with CSLB supporting copy', () => {
    const { getByText, queryByText } = render(<CompanyDetailScreen />);

    expect(getByText('License')).toBeTruthy();
    expect(getByText('Details from CSLB website')).toBeTruthy();
    expect(getByText('Business Information')).toBeTruthy();
    expect(getByText('Builder Co')).toBeTruthy();
    expect(getByText('View on CSLB')).toBeTruthy();
    expect(queryByText('Company details')).toBeNull();
    expect(queryByText('Full CSLB profile and compliance records')).toBeNull();
  });
});
