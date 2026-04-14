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
const mockFetchCustomersByEmail = jest.fn();
const mockPersistCustomersForEmail = jest.fn();
const mockSendEmailSignInCode = jest.fn();
const mockToCustomerProfile = jest.fn((customer) => ({ insuredId: customer.insuredId, fullName: 'Jane Builder' }));
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
  fetchCustomersByEmail: (...args: unknown[]) => mockFetchCustomersByEmail(...args),
}));
jest.mock('@/services/auth-flow', () => ({
  persistCustomersForEmail: (...args: unknown[]) => mockPersistCustomersForEmail(...args),
  sendEmailSignInCode: (...args: unknown[]) => mockSendEmailSignInCode(...args),
  toCustomerProfile: (...args: unknown[]) => mockToCustomerProfile(...args),
  toUserFacingError: (...args: unknown[]) => mockToUserFacingError(...args),
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
      completeSignIn: jest.fn(),
    });
    mockIsOtpRateLimitError.mockReturnValue(false);
  });

  it('verifies the code, syncs customers, and routes into the app', async () => {
    const completeSignIn = jest.fn();
    mockUseAuth.mockReturnValue({
      pendingEmail: 'jane@example.com',
      completeSignIn,
    });
    mockVerifyEmailSignInCode.mockResolvedValue('jane@example.com');
    mockFetchCustomersByEmail.mockResolvedValue([buildCustomerLookupRecord()]);
    mockPersistCustomersForEmail.mockResolvedValue(undefined);

    const { getByTestId, getByText } = render(<VerifyScreen />);

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    fireEvent.press(getByText('Verify and Continue'));

    await waitFor(() =>
      expect(mockVerifyEmailSignInCode).toHaveBeenCalledWith('jane@example.com', '123456')
    );

    expect(mockFetchCustomersByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(mockPersistCustomersForEmail).toHaveBeenCalledWith('jane@example.com', [buildCustomerLookupRecord()]);
    expect(completeSignIn).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ insuredId: 'LIC-123456' })
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('redirects back to login when there is no pending email', async () => {
    mockUseAuth.mockReturnValue({
      pendingEmail: '',
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
});
