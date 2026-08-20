import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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
  fetchAccountByBusinessEmail: (...args: unknown[]) => mockFetchAccountByBusinessEmail(...args),
}));
jest.mock('@/services/auth-flow', () => ({
  sendEmailSignInCode: (...args: unknown[]) => mockSendEmailSignInCode(...args),
  isOtpRateLimitError: (...args: unknown[]) => mockIsOtpRateLimitError(...args),
  toUserFacingError: (error: Error, fallback: string) =>
    mockToUserFacingError(error, fallback),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => mockGetPortalConfig(),
}));

const LoginScreen = require('@/app/(auth)/login').default;

describe('LoginScreen', () => {
  beforeEach(() => {
    mockGetPortalConfig.mockReturnValue({
      demo: { enabled: false, profile: null, data: null },
      review: { enabled: false, email: null, code: null, data: null },
    });
    mockUseAuth.mockReturnValue({
      setPendingEmail: jest.fn(),
      setCustomer: jest.fn(),
    });
    mockUseLocalSearchParams.mockReturnValue({});
    mockIsOtpRateLimitError.mockReturnValue(false);
  });

  it('sends a sign-in code before requesting PBIA account data', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockSendEmailSignInCode.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), ' Jane@Example.com ');
    fireEvent.press(getByText('Continue'));

    expect(mockSendEmailSignInCode).toHaveBeenCalledWith('jane@example.com');
    expect(mockFetchAccountByBusinessEmail).not.toHaveBeenCalled();
    await waitFor(() => expect(setPendingEmail).toHaveBeenCalledWith('jane@example.com'));
    await waitFor(() => expect(setCustomer).toHaveBeenCalledWith(null));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(auth)/verify'));
  });

  it('routes to verify with a rate-limit hint when OTP requests are throttled', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
    mockSendEmailSignInCode.mockRejectedValue(new Error('too many requests'));
    mockIsOtpRateLimitError.mockReturnValue(true);

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'jane@example.com');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(setPendingEmail).toHaveBeenCalledWith('jane@example.com'));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/(auth)/verify',
        params: { hint: 'rate-limited' },
      })
    );
  });

  it('routes the configured demo email to fixed-code verification without sending an OTP', async () => {
    const setPendingEmail = jest.fn();
    const setCustomer = jest.fn();
    mockUseAuth.mockReturnValue({ setPendingEmail, setCustomer });
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

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('You@Company.com'), 'Demo@InsureProBuilders.com');
    fireEvent.press(getByText('Continue'));

    expect(mockSendEmailSignInCode).not.toHaveBeenCalled();
    expect(mockFetchAccountByBusinessEmail).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(setPendingEmail).toHaveBeenCalledWith(
        'demo@insureprobuilders.com',
        '101000937'
      )
    );
    expect(setCustomer).toHaveBeenCalledWith(null);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(auth)/verify',
      params: { hint: 'apple-review' },
    });
  });
});
