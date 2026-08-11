import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildCustomerLookupRecord } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockUseAuth = jest.fn();
const mockFetchAccountByBusinessEmail = jest.fn();
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

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/services/customer-api', () => ({
  fetchAccountByBusinessEmail: (...args: unknown[]) => mockFetchAccountByBusinessEmail(...args),
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
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: 'LIC-123456',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn: jest.fn(),
    });
    mockIsOtpRateLimitError.mockReturnValue(false);
    mockPersistCustomersForEmail.mockResolvedValue(undefined);
  });

  it('verifies the code, syncs customers, and routes into the app', async () => {
    const completeSignIn = jest.fn();
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      pendingInsuredId: 'LIC-123456',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockFetchAccountByBusinessEmail.mockResolvedValue(buildCustomerLookupRecord());
    mockPersistCustomersForEmail.mockResolvedValue(undefined);

    const { getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() =>
      expect(mockVerifyEmailSignInCode).toHaveBeenCalledWith('jane@example.com', '123456')
    );

    expect(mockFetchAccountByBusinessEmail).toHaveBeenCalledWith('jane@example.com');
    expect(mockPersistCustomersForEmail).toHaveBeenCalledWith('jane@example.com', [buildCustomerLookupRecord()]);
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
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockFetchAccountByBusinessEmail.mockResolvedValue(buildCustomerLookupRecord());
    mockPersistCustomersForEmail.mockRejectedValue(
      new Error('Unable to save customer profile to Supabase (row level security).')
    );

    const { getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() =>
      expect(mockFetchAccountByBusinessEmail).toHaveBeenCalledWith('jane@example.com')
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

  it('redirects back to login when there is no pending email', async () => {
    mockUseAuth.mockReturnValue({
      pendingEmail: '',
      pendingInsuredId: '',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn: jest.fn(),
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

  it('requires Supabase verification for the Apple review email', async () => {
    const completeSignIn = jest.fn();
    mockUseLocalSearchParams.mockReturnValue({ hint: 'apple-review' });
    mockUseAuth.mockReturnValue({
      pendingEmail: 'demo@insureprobuilders.com',
      pendingInsuredId: '101000937',
      pendingSignup: null,
      clearPendingSignup: jest.fn(),
      completeSignIn,
    });
    mockFetchAccountByBusinessEmail.mockResolvedValue(
      buildCustomerLookupRecord({
        eMail: 'demo@insureprobuilders.com',
        insuredId: '101000937',
        commercialName: 'UrbanEdge Construction Inc.',
      })
    );

    mockVerifyEmailSignInCode.mockResolvedValue('demo@insureprobuilders.com');
    const { getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '111111');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() =>
      expect(completeSignIn).toHaveBeenCalledWith(
        'demo@insureprobuilders.com',
        expect.objectContaining({ insuredId: '101000937' }),
        '101000937'
      )
    );
    expect(mockVerifyEmailSignInCode).toHaveBeenCalledWith(
      'demo@insureprobuilders.com',
      '111111'
    );
    expect(mockFetchAccountByBusinessEmail).toHaveBeenCalledWith('demo@insureprobuilders.com');
    expect(mockPersistCustomersForEmail).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
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
    });
    mockVerifyEmailSignInCode.mockResolvedValue('new@example.com');
    mockCreateClientSignup.mockResolvedValue({ id: 'signup-1' });
    mockFetchAccountByBusinessEmail.mockResolvedValue(
      buildCustomerLookupRecord({ eMail: 'new@example.com' })
    );

    const { getByTestId, getByText } = render(<VerifyScreen />);
    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() => expect(mockCreateClientSignup).toHaveBeenCalledWith(pendingSignup));
    expect(clearPendingSignup).toHaveBeenCalled();
    expect(completeSignIn).toHaveBeenCalledWith(
      'new@example.com',
      expect.any(Object),
      expect.anything()
    );
  });
});
