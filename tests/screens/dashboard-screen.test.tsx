import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  buildCustomer,
  buildPaymentEligibility,
  buildPaymentTermOption,
} from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseAuth = jest.fn();
const mockUsePolicies = jest.fn();
const mockUsePayments = jest.fn();
const mockUseCompanyProfile = jest.fn();
const mockFetchClientAgent = jest.fn();
const mockRefreshPaymentEligibility = jest.fn();
const mockOpenExternalLink = jest.fn();
const mockOpenInAppBrowser = jest.fn();
const mockCreateClientContactRequest = jest.fn();
const mockGetPortalConfig = jest.fn();
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
  useFocusEffect: (callback: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/context/policies-context', () => ({
  usePolicies: () => mockUsePolicies(),
}));
jest.mock('@/context/payments-context', () => ({
  usePayments: () => mockUsePayments(),
}));
jest.mock('@/hooks/use-company-profile', () => ({
  useCompanyProfile: () => mockUseCompanyProfile(),
}));
jest.mock('@/services/agent-api', () => ({
  fetchClientAgent: (...args: unknown[]) => mockFetchClientAgent(...args),
}));
jest.mock('@/services/contact-request-api', () => ({
  createClientContactRequest: (...args: unknown[]) => mockCreateClientContactRequest(...args),
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
      review: {
        enabled: false,
        email: null,
        code: null,
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
    mockUsePolicies.mockReturnValue({
      policies: [],
      isLoadingPolicies: false,
      policiesError: null,
      refreshPolicies: jest.fn(),
    });
    mockUsePayments.mockReturnValue({
      paymentRecords: [],
      payableRecords: [],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: mockRefreshPaymentEligibility,
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
    mockFetchClientAgent.mockResolvedValue({
        id: 'agent-1',
        firstName: 'Patricia',
        lastName: 'Negrete',
        insuredDatabaseId: 'insured-db-1',
        email: 'patricia@example.com',
        phone: '5551112222',
      });
    mockOpenExternalLink.mockResolvedValue({ ok: true });
    mockOpenInAppBrowser.mockResolvedValue({ ok: true });
    mockCreateClientContactRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    mockAlert.mockClear();
  });

  it('refreshes payment requests when the dashboard receives focus', async () => {
    const { unmount } = render(<DashboardScreen />);

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(mockRefreshPaymentEligibility).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('shows linked agent contact details with the agency mailing address', async () => {
    const { findByText, getByText, queryByText } = render(<DashboardScreen />);

    await waitFor(() =>
      expect(mockFetchClientAgent).toHaveBeenCalledWith('jane@example.com', 'insured-db-1')
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

  it('shows an agency-billed payment notice and opens the payment form', async () => {
    mockUsePayments.mockReturnValue({
      paymentRecords: [buildPaymentEligibility()],
      payableRecords: [buildPaymentEligibility()],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: jest.fn(),
    });

    const { findAllByText, findByText, getByText, queryByText } = render(<DashboardScreen />);

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(await findByText('Payment Due')).toBeTruthy();
    expect(getByText('General Liability')).toBeTruthy();
    expect(queryByText('GL-1001')).toBeNull();
    expect(queryByText('General Liability • GL-1001')).toBeNull();
    expect((await findAllByText('$1,248.50')).length).toBeGreaterThan(0);
    expect(getByText('Due Aug 15, 2026')).toBeTruthy();
    expect(getByText('Premium payment requested by your agent.')).toBeTruthy();

    fireEvent.press(getByText('Pay Now'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/payment',
      params: { demandId: 'demand-1' },
    });
  });

  it('shows quote term choices without presenting the first option as one fixed bill', async () => {
    const termRecord = buildPaymentEligibility({
      lineOfBusiness: 'CONTRACTOR_LICENSE_BOND',
      paymentMode: 'TERM_OPTIONS',
      amountDue: 139,
      premium: 139,
      paidAmount: 0,
      selectedOptionId: null,
      termOptions: [
        buildPaymentTermOption(),
        buildPaymentTermOption({
          id: 'option-3',
          termYears: 3,
          amount: 330,
          label: '3 years',
          cardConvenienceFee: 9.9,
          cardTotalAmount: 339.9,
          achTotalAmount: 333,
        }),
      ],
      cardConvenienceFee: 4.17,
      cardTotalAmount: 143.17,
      achConvenienceFee: 3,
      achTotalAmount: 142,
    });
    mockUsePayments.mockReturnValue({
      paymentRecords: [termRecord],
      payableRecords: [termRecord],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: jest.fn(),
    });

    const { findByText, getByText, queryByText } = render(<DashboardScreen />);

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(await findByText('Term Options')).toBeTruthy();
    expect(getByText('Contractors License Bond')).toBeTruthy();
    expect(getByText('From $139.00')).toBeTruthy();
    expect(getByText('2 terms available')).toBeTruthy();
    expect(queryByText('Amount Due')).toBeNull();
    fireEvent.press(getByText('Choose Term & Pay'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/payment',
      params: { demandId: 'demand-1' },
    });
  });

  it('keeps a payment visible when its policy type is temporarily empty', async () => {
    const paymentRecord = buildPaymentEligibility({ lineOfBusiness: '', policyNumber: '' });
    mockUsePayments.mockReturnValue({
      paymentRecords: [paymentRecord],
      payableRecords: [paymentRecord],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: jest.fn(),
    });

    const { findByText } = render(<DashboardScreen />);

    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(await findByText('Payment Due')).toBeTruthy();
    expect(await findByText('Insurance payment')).toBeTruthy();
  });

  it('submits a COI contact request to PBIA and confirms success in the app', async () => {
    const { findByText, getByText } = render(<DashboardScreen />);

    await waitFor(() =>
      expect(mockFetchClientAgent).toHaveBeenCalledWith('jane@example.com', 'insured-db-1')
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
    expect(mockAlert.mock.calls[0][1]).toContain('A service request will be submitted to PBIA');
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
      expect(mockCreateClientContactRequest).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({
          accountId: 'insured-db-1',
          callbackNumber: '5551112222',
          preferredContactMethod: 'EMAIL',
          description: expect.stringContaining('Certificate of Insurance Request'),
        })
      )
    );
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

  it('uses the demo profile and blocks side effects for the fixed-code demo session', async () => {
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({
        email: 'demo@insureprobuilders.com',
        insuredId: '101000937',
      }),
      userEmail: 'demo@insureprobuilders.com',
    });
    mockGetPortalConfig.mockReturnValue({
      demo: {
        enabled: false,
        profile: 'marketing',
        data: null,
      },
      review: {
        enabled: true,
        email: 'demo@insureprobuilders.com',
        code: '111111',
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

    expect(mockFetchClientAgent).not.toHaveBeenCalled();
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

    expect(mockCreateClientContactRequest).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenLastCalledWith(
      'Demo mode',
      'This action is disabled while the marketing demo profile is active.'
    );
  });
});
