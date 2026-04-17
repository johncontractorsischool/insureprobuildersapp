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
const mockSendEmailSignInCode = jest.fn();
const mockIsOtpRateLimitError = jest.fn();
const mockToUserFacingError = jest.fn((error: Error, fallback: string) => error.message || fallback);

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
  sendEmailSignInCode: (...args: unknown[]) => mockSendEmailSignInCode(...args),
  isOtpRateLimitError: (...args: unknown[]) => mockIsOtpRateLimitError(...args),
  toUserFacingError: (...args: unknown[]) => mockToUserFacingError(...args),
}));

const LoginScreen = require('@/app/(auth)/login').default;

describe('LoginScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      setPendingEmail: jest.fn(),
      setCustomer: jest.fn(),
    });
    mockUseLocalSearchParams.mockReturnValue({});
    mockIsOtpRateLimitError.mockReturnValue(false);
  });

  it('sends a sign-in code and routes to verify when the email exists', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockFetchCustomersByEmail.mockResolvedValue([buildCustomerLookupRecord()]);
    mockSendEmailSignInCode.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), ' Jane@Example.com ');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(mockFetchCustomersByEmail).toHaveBeenCalledWith('jane@example.com'));

    expect(mockSendEmailSignInCode).toHaveBeenCalledWith('jane@example.com');
    await waitFor(() => expect(setPendingEmail).toHaveBeenCalledWith('jane@example.com', 'LIC-123456'));
    await waitFor(() => expect(setCustomer).toHaveBeenCalledWith(null));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(auth)/verify'));
  });

  it('requires a license number before sending OTP when multiple customers share the same email', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockFetchCustomersByEmail.mockResolvedValue([
      buildCustomerLookupRecord({ insuredId: 'LIC-111111', commercialName: 'First Builder Co' }),
      buildCustomerLookupRecord({ insuredId: 'LIC-222222', commercialName: 'Second Builder Co' }),
    ]);
    mockSendEmailSignInCode.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'jane@example.com');
    fireEvent.press(getByText('Continue'));

    expect(
      await findByText('Multiple accounts were found for that email. Enter your license number to continue.')
    ).toBeTruthy();
    expect(mockSendEmailSignInCode).not.toHaveBeenCalled();

    fireEvent.changeText(getByPlaceholderText('CSLB License Number'), 'lic-222222');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(mockSendEmailSignInCode).toHaveBeenCalledWith('jane@example.com'));
    await waitFor(() => expect(setPendingEmail).toHaveBeenCalledWith('jane@example.com', 'LIC-222222'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(auth)/verify'));
  });

  it('shows an error when no account exists for the entered email', async () => {
    mockFetchCustomersByEmail.mockResolvedValue([]);

    const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'jane@example.com');
    fireEvent.press(getByText('Continue'));

    expect(await findByText('No account was found for that email address.')).toBeTruthy();
    expect(mockSendEmailSignInCode).not.toHaveBeenCalled();
  });

  it('routes to verify with a rate-limit hint when OTP requests are throttled', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockFetchCustomersByEmail.mockResolvedValue([buildCustomerLookupRecord()]);
    mockSendEmailSignInCode.mockRejectedValue(new Error('too many requests'));
    mockIsOtpRateLimitError.mockReturnValue(true);

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'jane@example.com');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(setPendingEmail).toHaveBeenCalledWith('jane@example.com', 'LIC-123456'));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/(auth)/verify',
        params: { hint: 'rate-limited' },
      })
    );
  });
});
