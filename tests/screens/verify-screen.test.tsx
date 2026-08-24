import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PbiaApiError } from '@/services/pbia-client';
import { buildCustomerLookupRecord } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockUseAuth = jest.fn();
const mockResolveMyAccount = jest.fn();
const mockResolveMyAccountByLicense = jest.fn();
const mockCreateClientSignup = jest.fn();
const mockPersistCustomersForEmail = jest.fn();
const mockSendEmailSignInCode = jest.fn();
const mockToCustomerProfile = jest.fn((customer: { insuredId?: string | null }) => ({
  insuredId: customer.insuredId,
  fullName: 'Jane Builder',
}));
const mockToUserFacingError = jest.fn((error: Error, fallback: string) => error.message || fallback);
const mockVerifyEmailSignInCode = jest.fn();
const mockIsOtpRateLimitError = jest.fn();
const mockGetPortalConfig = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/services/customer-api', () => ({
  resolveMyAccount: (...args: unknown[]) => mockResolveMyAccount(...args),
  resolveMyAccountByLicense: (...args: unknown[]) =>
    mockResolveMyAccountByLicense(...args),
}));
jest.mock('@/services/client-signup-api', () => ({
  createClientSignup: (...args: unknown[]) => mockCreateClientSignup(...args),
}));
jest.mock('@/services/auth-flow', () => ({
  persistCustomersForEmail: (...args: unknown[]) => mockPersistCustomersForEmail(...args),
  sendEmailSignInCode: (...args: unknown[]) => mockSendEmailSignInCode(...args),
  toCustomerProfile: (customer: { insuredId?: string | null }) =>
    mockToCustomerProfile(customer),
  toUserFacingError: (error: Error, fallback: string) =>
    mockToUserFacingError(error, fallback),
  verifyEmailSignInCode: (...args: unknown[]) => mockVerifyEmailSignInCode(...args),
  isOtpRateLimitError: (...args: unknown[]) => mockIsOtpRateLimitError(...args),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => mockGetPortalConfig(),
}));
jest.mock('@/components/otp-input', () => ({
  OTPInput: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => {
    const React = require('react');
    const { TextInput } = require('react-native');
    return <TextInput testID="otp-input" value={value} onChangeText={onChange} />;
  },
}));

const VerifyScreen = require('@/app/(auth)/verify').default;

describe('VerifyScreen', () => {
  beforeEach(() => {
    mockGetPortalConfig.mockReturnValue({
      demo: { enabled: false, profile: null, data: null },
      review: { enabled: false, email: null, code: null, data: null },
    });
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: 'LIC-123456',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn: jest.fn(),
      signOut: jest.fn(),
    });
    mockIsOtpRateLimitError.mockReturnValue(false);
    mockPersistCustomersForEmail.mockResolvedValue(undefined);
    mockResolveMyAccountByLicense.mockReset();
  });

  it('verifies the code, syncs customers, and routes into the app', async () => {
    const completeSignIn = jest.fn();
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: 'LIC-123456',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
      signOut: jest.fn(),
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockResolveMyAccount.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 1,
      account: buildCustomerLookupRecord(),
    });
    mockPersistCustomersForEmail.mockResolvedValue(undefined);

    const { getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() =>
      expect(mockVerifyEmailSignInCode).toHaveBeenCalledWith('jane@example.com', '123456')
    );

    expect(mockResolveMyAccount).toHaveBeenCalledWith('jane@example.com');
    expect(mockPersistCustomersForEmail).toHaveBeenCalledWith('jane@example.com', [
      buildCustomerLookupRecord(),
    ]);
    expect(completeSignIn).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ insuredId: 'LIC-123456' }),
      'LIC-123456'
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('still completes sign in with the refreshed customer when Supabase cache sync is blocked', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const completeSignIn = jest.fn();
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: 'LIC-123456',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
      signOut: jest.fn(),
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockResolveMyAccount.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 1,
      account: buildCustomerLookupRecord(),
    });
    mockPersistCustomersForEmail.mockRejectedValue(
      new Error('Unable to save customer profile to Supabase (row level security).')
    );

    const { getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() =>
      expect(mockResolveMyAccount).toHaveBeenCalledWith('jane@example.com')
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Customer cache sync failed after successful OTP verification.',
      expect.any(Error)
    );
    expect(completeSignIn).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ insuredId: 'LIC-123456' }),
      'LIC-123456'
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    consoleWarnSpy.mockRestore();
  });

  it('signs out and blocks access when PBIA reports a deleted account', async () => {
    const completeSignIn = jest.fn();
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: 'LIC-123456',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
      signOut,
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockResolveMyAccount.mockRejectedValue(
      new PbiaApiError(
        403,
        'This account is unavailable. Contact support if you need to re-establish access.',
        'ACCOUNT_ACCESS_BLOCKED'
      )
    );

    const { findByText, getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    expect(
      await findByText(
        'This account is unavailable. Contact support if you need to re-establish access.'
      )
    ).toBeTruthy();
    expect(signOut).toHaveBeenCalled();
    expect(completeSignIn).not.toHaveBeenCalled();
  });

  it('redirects back to login when there is no pending email', async () => {
    mockUseAuth.mockReturnValue({
      pendingEmail: '',
      pendingInsuredId: '',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn: jest.fn(),
      signOut: jest.fn(),
    });

    render(<VerifyScreen />);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/login'));
  });

  it('shows the rate-limit hint notice when it is passed in the route params', async () => {
    mockUseLocalSearchParams.mockReturnValue({ hint: 'rate-limited' });

    const { findByText } = render(<VerifyScreen />);

    expect(
      await findByText('Use your latest verification code, or wait before requesting another email.')
    ).toBeTruthy();
  });

  it('accepts the configured demo code without calling Supabase or PBIA', async () => {
    const completeSignIn = jest.fn();
    mockUseLocalSearchParams.mockReturnValue({ hint: 'apple-review' });
    mockUseAuth.mockReturnValue({
      pendingEmail: 'demo@insureprobuilders.com',
      pendingInsuredId: '101000937',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
      signOut: jest.fn(),
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
          customer: {
            email: 'demo@insureprobuilders.com',
            insuredId: '101000937',
            commercialName: 'UrbanEdge Construction Inc.',
          },
        },
      },
    });

    const { getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '111111');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() =>
      expect(completeSignIn).toHaveBeenCalledWith(
        'demo@insureprobuilders.com',
        expect.objectContaining({ commercialName: 'UrbanEdge Construction Inc.' }),
        '101000937'
      )
    );
    expect(mockVerifyEmailSignInCode).not.toHaveBeenCalled();
    expect(mockResolveMyAccount).not.toHaveBeenCalled();
    expect(mockPersistCustomersForEmail).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('rejects an incorrect fixed code for the configured demo email', async () => {
    const completeSignIn = jest.fn();
    mockUseLocalSearchParams.mockReturnValue({ hint: 'apple-review' });
    mockUseAuth.mockReturnValue({
      pendingEmail: 'demo@insureprobuilders.com',
      pendingInsuredId: '101000937',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
      signOut: jest.fn(),
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
        data: { customer: { insuredId: '101000937' } },
      },
    });

    const { findByText, getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '222222');
    fireEvent.press(getByText('Verify and Continue'));

    expect(
      await findByText('Invalid demo code. Use the configured demo code to continue.')
    ).toBeTruthy();
    expect(completeSignIn).not.toHaveBeenCalled();
    expect(mockVerifyEmailSignInCode).not.toHaveBeenCalled();
  });

  it('asks for a license number when the verified email owns multiple accounts', async () => {
    const completeSignIn = jest.fn();
    const secondCustomer = buildCustomerLookupRecord({
      accountId: 'insured-db-2',
      databaseId: 'insured-db-2',
      legalName: 'Second Builder Co',
      commercialName: 'Second Builder Co',
      licenseNumber: 'LIC-222222',
      insuredId: 'LIC-222222',
    });
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: '',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
      signOut: jest.fn(),
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockResolveMyAccount.mockResolvedValue({ status: 'LICENSE_REQUIRED', matchCount: 2 });
    mockResolveMyAccountByLicense.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 2,
      account: secondCustomer,
    });

    const { findByText, getByLabelText, getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    expect(await findByText('Choose Your Account')).toBeTruthy();
    expect(completeSignIn).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText('License Number'), 'LIC-222222');
    fireEvent.press(getByText('Open Account'));

    await waitFor(() =>
      expect(mockResolveMyAccountByLicense).toHaveBeenCalledWith(
        'jane@example.com',
        'LIC-222222'
      )
    );
    expect(mockPersistCustomersForEmail).toHaveBeenCalledWith('jane@example.com', [
      secondCustomer,
    ]);
    expect(completeSignIn).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ insuredId: 'LIC-222222' }),
      'LIC-222222'
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('does not open an account when the supplied license is not connected to the email', async () => {
    const completeSignIn = jest.fn();
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: '',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
      signOut: jest.fn(),
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockResolveMyAccount.mockResolvedValue({ status: 'LICENSE_REQUIRED', matchCount: 2 });
    mockResolveMyAccountByLicense.mockRejectedValue(
      new PbiaApiError(404, 'Client account could not be resolved')
    );

    const { findByText, getByLabelText, getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));
    await findByText('Choose Your Account');
    fireEvent.changeText(getByLabelText('License Number'), 'LIC-999999');
    fireEvent.press(getByText('Open Account'));

    expect(
      await findByText('That license number is not associated with this verified email address.')
    ).toBeTruthy();
    expect(completeSignIn).not.toHaveBeenCalled();
  });

  it('creates a pending signup only after Supabase verifies its email', async () => {
    const completeSignIn = jest.fn();
    const clearPendingSignup = jest.fn();
    const pendingSignup = {
      legalName: 'Builder Co',
      email: 'new@example.com',
      status: 'PROSPECT' as const,
      licenseNumber: '1144038',
      primaryContactFirstName: 'New',
      primaryContactLastName: 'Client',
      addressLine1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
    };
    mockUseAuth.mockReturnValue({
      pendingEmail: 'new@example.com',
      pendingInsuredId: '',
      pendingSignup,
      clearPendingSignup,
      completeSignIn,
      signOut: jest.fn(),
    });
    mockVerifyEmailSignInCode.mockResolvedValue('new@example.com');
    mockCreateClientSignup.mockResolvedValue({ id: 'signup-1' });
    mockResolveMyAccount
      .mockResolvedValueOnce({ status: 'SIGNUP_ALLOWED', matchCount: 0 })
      .mockResolvedValueOnce({
        status: 'ACCOUNT_RESOLVED',
        matchCount: 1,
        account: buildCustomerLookupRecord({ eMail: 'new@example.com' }),
      });

    const { getByTestId, getByText } = render(<VerifyScreen />);
    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() => expect(mockCreateClientSignup).toHaveBeenCalledWith(pendingSignup));
    expect(mockResolveMyAccount).toHaveBeenCalledTimes(2);
    expect(clearPendingSignup).toHaveBeenCalled();
    expect(completeSignIn).toHaveBeenCalledWith(
      'new@example.com',
      expect.any(Object),
      expect.anything()
    );
  });

  it('does not create a duplicate signup when the verified email already resolves', async () => {
    const completeSignIn = jest.fn();
    const clearPendingSignup = jest.fn();
    const pendingSignup = {
      legalName: 'Builder Co',
      email: 'existing@example.com',
      status: 'PROSPECT' as const,
      licenseNumber: '1144038',
      primaryContactFirstName: 'Existing',
      primaryContactLastName: 'Client',
      addressLine1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
    };
    mockUseAuth.mockReturnValue({
      pendingEmail: 'existing@example.com',
      pendingInsuredId: '',
      pendingSignup,
      clearPendingSignup,
      completeSignIn,
      signOut: jest.fn(),
    });
    mockVerifyEmailSignInCode.mockResolvedValue('existing@example.com');
    mockResolveMyAccount.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 1,
      account: buildCustomerLookupRecord({ eMail: 'existing@example.com' }),
    });

    const { getByTestId, getByText } = render(<VerifyScreen />);
    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() => expect(completeSignIn).toHaveBeenCalled());
    expect(mockCreateClientSignup).not.toHaveBeenCalled();
    expect(clearPendingSignup).toHaveBeenCalled();
  });
});
