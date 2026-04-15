import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildCustomer } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseAuth = jest.fn();
const mockUseCompanyProfile = jest.fn();
const mockFetchInsuredAgentsByInsuredDatabaseId = jest.fn();
const mockOpenExternalLink = jest.fn();
const mockOpenInAppBrowser = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/hooks/use-company-profile', () => ({
  useCompanyProfile: () => mockUseCompanyProfile(),
}));
jest.mock('@/services/agent-api', () => ({
  fetchInsuredAgentsByInsuredDatabaseId: (...args: unknown[]) =>
    mockFetchInsuredAgentsByInsuredDatabaseId(...args),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => ({
    agent: {
      name: 'Fallback Agent',
      phone: null,
      email: null,
      smsPhone: null,
      scheduleUrl: 'https://calendar.google.com/agent',
    },
    company: {
      licenseNumber: null,
      cslbUrl: null,
    },
    actions: {
      intakeFormsUrl: null,
      issueCoiUrl: null,
      supportEmail: 'support@insureprobuilders.com',
    },
  }),
}));
jest.mock('@/components/brand-mark', () => ({
  BrandMark: () => null,
}));
jest.mock('@/components/contact-us-menu', () => ({
  ContactUsMenu: () => null,
}));
jest.mock('@/utils/external-actions', () => {
  const actual = jest.requireActual('@/utils/external-actions');
  return {
    ...actual,
    openExternalLink: (...args: unknown[]) => mockOpenExternalLink(...args),
    openInAppBrowser: (...args: unknown[]) => mockOpenInAppBrowser(...args),
  };
});

const DashboardScreen = require('@/app/(tabs)/index').default;

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();

    mockUseAuth.mockReturnValue({
      customer: buildCustomer({
        databaseId: 'insured-db-1',
        commercialName: 'Builder Co',
      }),
      userEmail: 'jane@example.com',
    });
    mockUseCompanyProfile.mockReturnValue({
      isLoadingCompany: false,
      companyLookupNotice: null,
      cslbLink: 'https://cslb.ca.gov/license-detail',
      licenseRows: [{ label: 'License #', value: 'LIC-123456' }],
      statusChips: ['Active'],
      statusFallbackText: 'Active',
      businessName: 'Builder Co',
      businessRows: [
        { label: 'Street', value: '123 Main St' },
        { label: 'City/State/ZIP', value: 'Los Angeles, CA 90001' },
      ],
    });
    mockFetchInsuredAgentsByInsuredDatabaseId.mockResolvedValue([
      {
        databaseId: 'agent-1',
        firstName: 'Patricia',
        lastName: 'Negrete',
        insuredDatabaseId: 'insured-db-1',
        email: 'patricia@example.com',
        phone: '5551112222',
        cellPhone: '5559990000',
        active: true,
        primaryRole: 'Agent',
        agentType: 'Producer',
      },
    ]);
    mockOpenExternalLink.mockResolvedValue({ ok: true });
    mockOpenInAppBrowser.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows linked agent contact details with the agency mailing address', async () => {
    const { findByText, getByText, queryByText } = render(<DashboardScreen />);

    await waitFor(() =>
      expect(mockFetchInsuredAgentsByInsuredDatabaseId).toHaveBeenCalledWith('insured-db-1')
    );

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(await findByText('Patricia Negrete')).toBeTruthy();
    expect(queryByText('Support contact for your account')).toBeNull();
    expect(getByText('Phone: 5551112222')).toBeTruthy();
    expect(getByText('Email: patricia@example.com')).toBeTruthy();
    expect(getByText('Agency Address: 123 Main St, Los Angeles, CA 90001')).toBeTruthy();
    expect(getByText('SMS/Text')).toBeTruthy();

    fireEvent.press(getByText('Phone: 5551112222'));
    expect(mockOpenExternalLink).toHaveBeenCalledWith(
      'tel:5551112222',
      'Agent phone number is not configured yet.'
    );

    fireEvent.press(getByText('Email: patricia@example.com'));
    expect(mockOpenExternalLink).toHaveBeenCalledWith(
      'mailto:patricia@example.com',
      'Agent email is not configured yet.'
    );

    fireEvent.press(getByText('Agency Address: 123 Main St, Los Angeles, CA 90001'));
    expect(mockOpenExternalLink).toHaveBeenCalledWith(
      'http://maps.apple.com/?q=123%20Main%20St%2C%20Los%20Angeles%2C%20CA%2090001',
      'Agency mailing address is not configured yet.'
    );
  });
});
