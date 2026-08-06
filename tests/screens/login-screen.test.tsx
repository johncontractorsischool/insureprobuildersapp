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
const mockSendEmailSignInCode = jest.fn();
const mockIsOtpRateLimitError = jest.fn();
const mockToUserFacingError = jest.fn((error: Error, fallback: string) => error.message || fallback);
const mockGetPortalConfig = jest.fn(() => ({
  demo: {
    enabled: false,
    profile: null,
    data: null,
  },
  review: {
    enabled: false,
    email: null,
    code: null,
  },
}));

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
jest.mock('@/services/auth-flow', () => ({
  sendEmailSignInCode: (...args: unknown[]) => mockSendEmailSignInCode(...args),
  isOtpRateLimitError: (...args: unknown[]) => mockIsOtpRateLimitError(...args),
  toUserFacingError: (...args: unknown[]) => mockToUserFacingError(...args),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => mockGetPortalConfig(),
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
      },
    });
  });

  it('sends a sign-in code and routes to verify when the email exists', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockFetchAccountByBusinessEmail.mockResolvedValue(buildCustomerLookupRecord());
    mockSendEmailSignInCode.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), ' Jane@Example.com ');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(mockFetchAccountByBusinessEmail).toHaveBeenCalledWith('jane@example.com'));

    expect(mockSendEmailSignInCode).toHaveBeenCalledWith('jane@example.com');
    await waitFor(() => expect(setPendingEmail).toHaveBeenCalledWith('jane@example.com', 'LIC-123456'));
    await waitFor(() => expect(setCustomer).toHaveBeenCalledWith(null));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(auth)/verify'));
  });

  it('shows an error when no account exists for the entered email', async () => {
    mockFetchAccountByBusinessEmail.mockResolvedValue(null);

    const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'jane@example.com');
    fireEvent.press(getByText('Continue'));

    expect(await findByText('No account was found for that primary business email address.')).toBeTruthy();
    expect(mockSendEmailSignInCode).not.toHaveBeenCalled();
  });

  it('does not send OTP when PBIA reports a duplicate primary business email', async () => {
    mockFetchAccountByBusinessEmail.mockRejectedValue(
      new Error('Multiple client accounts use this business email')
    );

    const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'shared@example.com');
    fireEvent.press(getByText('Continue'));

    expect(await findByText('Multiple client accounts use this business email')).toBeTruthy();
    expect(mockSendEmailSignInCode).not.toHaveBeenCalled();
  });

  it('routes to verify with a rate-limit hint when OTP requests are throttled', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockFetchAccountByBusinessEmail.mockResolvedValue(buildCustomerLookupRecord());
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

  it('routes the Apple review demo email directly to verify without sending OTP when review mode is enabled', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockGetPortalConfig.mockReturnValue({
      demo: {
        enabled: false,
        profile: null,
        data: null,
      },
      review: {
        enabled: true,
        email: 'demo@insureprobuilders.com',
        code: '111111',
      },
    });
    mockFetchAccountByBusinessEmail.mockResolvedValue(
      buildCustomerLookupRecord({
        eMail: 'demo@insureprobuilders.com',
        insuredId: '101000937',
      })
    );

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'Demo@InsureProBuilders.com');
    fireEvent.press(getByText('Continue'));

    await waitFor(() =>
      expect(mockFetchAccountByBusinessEmail).toHaveBeenCalledWith('demo@insureprobuilders.com')
    );
    await waitFor(() => expect(setPendingEmail).toHaveBeenCalledWith('demo@insureprobuilders.com', '101000937'));
    expect(mockSendEmailSignInCode).not.toHaveBeenCalled();
    expect(setCustomer).toHaveBeenCalledWith(null);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(auth)/verify',
      params: { hint: 'apple-review' },
    });
  });
});
