import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

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
const mockSendSmtpEmail = jest.fn();
const mockGetPortalConfig = jest.fn();
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

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
jest.mock('@/services/smtp-email-api', () => ({
  sendSmtpEmail: (...args: unknown[]) => mockSendSmtpEmail(...args),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => mockGetPortalConfig(),
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
    mockGetPortalConfig.mockReturnValue({
      demo: {
        enabled: false,
        profile: null,
        data: null,
      },
      agent: {
        name: 'Fallback Agent',
        phone: null,
        email: null,
        smsPhone: null,
        mailingAddress: '2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742',
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
    });

    mockUseAuth.mockReturnValue({
      customer: buildCustomer({
        databaseId: 'insured-db-1',
        commercialName: 'Builder Co',
        firstName: 'Jane',
        lastName: 'Builder',
        email: 'jane@example.com',
        phone: '5551112222',
        insuredId: 'LIC-123456',
      }),
      userEmail: 'jane@example.com',
    });
    mockUseCompanyProfile.mockReturnValue({
      isLoadingCompany: false,
      companyLookupNotice: null,
      cslbLink: 'https://cslb.ca.gov/license-detail',
      cslbLicense: null,
      licenseRows: [{ label: 'License #', value: 'LIC-123456' }],
      statusChips: ['Active'],
      statusFallbackText: 'Active',
      businessName: 'Builder Co',
      businessRows: [
        { label: 'Street', value: '123 Main St' },
        { label: 'City/State/ZIP', value: 'Los Angeles, CA 90001' },
      ],
      classifications: [],
      bonding: [],
      workersCompRows: [],
      personnel: [],
      hasDetailContent: true,
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
    mockSendSmtpEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    mockAlert.mockClear();
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
    expect(
      getByText('Agency Address: 2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742')
    ).toBeTruthy();
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

    fireEvent.press(
      getByText('Agency Address: 2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742')
    );
    expect(mockOpenExternalLink).toHaveBeenCalledWith(
      'http://maps.apple.com/?q=2865%20Sunrise%20Blvd%20Ste%20110%2C%20Rancho%20Cordova%2C%20CA%2095742',
      'Agency mailing address is not configured yet.'
    );
  });

  it('sends a COI request email to support and confirms success in the app', async () => {
    const { findByText, getByText } = render(<DashboardScreen />);

    await waitFor(() =>
      expect(mockFetchInsuredAgentsByInsuredDatabaseId).toHaveBeenCalledWith('insured-db-1')
    );

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(await findByText('Request COI')).toBeTruthy();

    fireEvent.press(getByText('Request COI'));

    expect(mockAlert).toHaveBeenCalledWith(
      'Request COI',
      expect.stringContaining('Are you sure you want to request a certificate of insurance?'),
      expect.any(Array)
    );
    expect(mockAlert.mock.calls[0][1]).toContain('An email will be sent to the agency');
    expect(mockAlert.mock.calls[0][1]).toContain('support@insureprobuilders.com');
    expect(mockAlert.mock.calls[0][1]).toContain('Business Name: Builder Co');
    expect(mockAlert.mock.calls[0][1]).toContain('Contact Person: Jane Builder');
    expect(mockAlert.mock.calls[0][1]).toContain('Email: jane@example.com');

    const confirmationButtons = mockAlert.mock.calls[0][2] as
      | Array<{ text?: string; onPress?: () => void }>
      | undefined;
    const sendRequestButton = confirmationButtons?.find((button) => button.text === 'Send Request');

    await act(async () => {
      sendRequestButton?.onPress?.();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(mockSendSmtpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Certificate of Insurance Request',
          to: ['support@insureprobuilders.com'],
        })
      )
    );

    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('This client is requesting a certificate of insurance');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('Builder Co');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('Jane Builder');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('jane@example.com');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('5551112222');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('insured-db-1');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('LIC-123456');
    expect(mockAlert).toHaveBeenNthCalledWith(
      2,
      'Request sent',
      'Your certificate of insurance request has been sent successfully.'
    );
    expect(mockOpenExternalLink).not.toHaveBeenCalledWith(
      expect.stringContaining('mailto:'),
      expect.any(String)
    );
  });

  it('uses the demo profile and blocks side-effect actions when demo mode is enabled', async () => {
    mockGetPortalConfig.mockReturnValue({
      demo: {
        enabled: true,
        profile: 'marketing',
        data: {
          id: 'marketing',
          label: 'Marketing Demo',
          customer: buildCustomer({
            databaseId: 'demo-insured-db-urbanedge',
            commercialName: 'UrbanEdge Construction Inc.',
            firstName: 'Daniel',
            lastName: 'Reyes',
            email: 'demo@insureprobuilders.com',
            phone: '916-555-0148',
            insuredId: '101000937',
          }),
          agent: {
            name: 'Emily Carter',
            phone: '916-555-0123',
            email: 'emily.carter@insureprobuilders.com',
            smsPhone: '916-555-0188',
            mailingAddress: '2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742',
            scheduleUrl: null,
          },
          company: {
            licenseNumber: '101000937',
            cslbUrl: 'https://www.cslb.ca.gov/license',
            companyLookupNotice: 'Marketing demo profile is active. Live CSLB data is disabled.',
            businessName: 'UrbanEdge Construction Inc.',
            businessRows: [
              { label: 'Street', value: '2865 Sunrise Blvd Ste 110' },
              { label: 'City/State/ZIP', value: 'Rancho Cordova, CA 95742' },
            ],
            licenseRows: [{ label: 'License #', value: '101000937' }],
            statusChips: ['Active'],
            statusFallbackText: 'Active',
            classifications: [],
            bonding: [],
            workersCompRows: [],
            personnel: [],
          },
          ui: {
            disableExternalActions: true,
            disableRequestEmails: true,
            disabledMessage: 'This action is disabled while the marketing demo profile is active.',
          },
        },
      },
      agent: {
        name: 'Emily Carter',
        phone: '916-555-0123',
        email: 'emily.carter@insureprobuilders.com',
        smsPhone: '916-555-0188',
        mailingAddress: '2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742',
        scheduleUrl: null,
      },
      company: {
        licenseNumber: '101000937',
        cslbUrl: 'https://www.cslb.ca.gov/license',
      },
      actions: {
        intakeFormsUrl: null,
        issueCoiUrl: null,
        supportEmail: 'support@insureprobuilders.com',
      },
    });
    mockUseCompanyProfile.mockReturnValue({
      isLoadingCompany: false,
      companyLookupNotice: 'Marketing demo profile is active. Live CSLB data is disabled.',
      cslbLink: 'https://www.cslb.ca.gov/license',
      cslbLicense: null,
      licenseRows: [{ label: 'License #', value: '101000937' }],
      statusChips: ['Active'],
      statusFallbackText: 'Active',
      businessName: 'UrbanEdge Construction Inc.',
      businessRows: [
        { label: 'Street', value: '2865 Sunrise Blvd Ste 110' },
        { label: 'City/State/ZIP', value: 'Rancho Cordova, CA 95742' },
      ],
      classifications: [],
      bonding: [],
      workersCompRows: [],
      personnel: [],
      hasDetailContent: true,
    });

    const { findAllByText, getByText } = render(<DashboardScreen />);

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(mockFetchInsuredAgentsByInsuredDatabaseId).not.toHaveBeenCalled();
    expect((await findAllByText('UrbanEdge Construction Inc.')).length).toBeGreaterThan(0);
    expect(getByText('Email: demo@insureprobuilders.com')).toBeTruthy();
    expect(getByText('Emily Carter')).toBeTruthy();

    fireEvent.press(getByText('Phone: 916-555-0123'));
    expect(mockAlert).toHaveBeenCalledWith(
      'Demo mode',
      'This action is disabled while the marketing demo profile is active.'
    );
    expect(mockOpenExternalLink).not.toHaveBeenCalled();

    fireEvent.press(getByText('Request COI'));
    const latestAlertCall = mockAlert.mock.calls[mockAlert.mock.calls.length - 1];
    const confirmationButtons = latestAlertCall?.[2] as
      | Array<{ text?: string; onPress?: () => void }>
      | undefined;
    const sendRequestButton = confirmationButtons?.find((button) => button.text === 'Send Request');

    await act(async () => {
      sendRequestButton?.onPress?.();
      await Promise.resolve();
    });

    expect(mockSendSmtpEmail).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenLastCalledWith(
      'Demo mode',
      'This action is disabled while the marketing demo profile is active.'
    );
  });
});
