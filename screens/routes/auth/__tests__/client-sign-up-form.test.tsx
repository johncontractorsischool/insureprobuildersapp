import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ClientSignUpForm } from '@/screens/routes/auth/client-sign-up-form';
import { useAuth } from '@/context/auth-context';
import { useClientSignup } from '@/hooks/use-client-signup';
import { router } from 'expo-router';

jest.mock('@/hooks/use-client-signup', () => ({
  useClientSignup: jest.fn(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

const mockedUseClientSignup = useClientSignup as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedRouterPush = router.push as jest.Mock;

function mockHookState(overrides: Record<string, unknown> = {}) {
  mockedUseClientSignup.mockReturnValue({
    form: {
      businessName: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zipCode: '',
      licenseNumber: '',
      appFeeNumber: '',
    },
    identifierType: 'license',
    errors: {},
    uiState: 'idle',
    isSubmitting: false,
    errorMessage: '',
    response: null,
    lastRequest: null,
    updateField: jest.fn(),
    setIdentifierValue: jest.fn(),
    setSelectedIdentifierType: jest.fn(),
    validateIdentifierField: jest.fn(),
    validateField: jest.fn(),
    submit: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  });
}

describe('ClientSignUpForm', () => {
  const mockSetPendingEmail = jest.fn();
  const mockSetPendingSignup = jest.fn();
  const mockSetCustomer = jest.fn();

  beforeEach(() => {
    mockedRouterPush.mockReset();
    mockSetPendingEmail.mockReset();
    mockSetPendingSignup.mockReset();
    mockSetCustomer.mockReset();
    mockedUseAuth.mockReturnValue({
      setPendingEmail: mockSetPendingEmail,
      setPendingSignup: mockSetPendingSignup,
      setCustomer: mockSetCustomer,
    });
  });

  it('does not render sync status/result cards even when response exists', () => {
    mockHookState({
      uiState: 'success',
      response: {
        ok: true,
        result: {
          status: 'existing',
          message: 'A matching PBIA account already exists.',
          cslb: {
            licenseNumber: '1105382',
            status: 'Active',
          },
          momentum: {
            email: 'john@example.com',
            firstName: 'John',
          },
        },
      },
    });

    render(<ClientSignUpForm />);

    expect(screen.queryByText('Sync status')).toBeNull();
    expect(screen.queryByText('CSLB')).toBeNull();
    expect(screen.queryByText('MOMENTUM')).toBeNull();
    expect(screen.queryByTestId('sync-status-value')).toBeNull();
    expect(screen.queryByTestId('sync-result-message')).toBeNull();
  });

  it('renders error state', () => {
    mockHookState({
      uiState: 'error',
      errorMessage: 'Network request failed.',
      response: null,
    });

    render(<ClientSignUpForm />);

    expect(screen.getByText('Account Creation Failed')).toBeTruthy();
    expect(screen.getByTestId('sync-error-message')).toHaveTextContent('Network request failed.');
  });

  it('shows Create Account action and hides agent name input', () => {
    mockHookState();

    render(<ClientSignUpForm />);

    expect(screen.getByText('Create Account')).toBeTruthy();
    expect(screen.queryByText('Agent Name (Optional)')).toBeNull();
  });

  it('navigates to verify when create account submit succeeds', async () => {
    const request = {
      legalName: 'Builder Co',
      email: 'john@example.com',
      status: 'PROSPECT' as const,
      licenseNumber: '1144038',
      primaryContactFirstName: 'John',
      primaryContactLastName: 'Builder',
      addressLine1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
    };
    const submit = jest.fn().mockResolvedValue({
      email: 'john@example.com',
      request,
      rateLimited: false,
      otpDeliveryFailed: false,
    });
    mockHookState({ submit });

    render(<ClientSignUpForm />);

    fireEvent.press(screen.getByText('Create Account'));

    await waitFor(() => {
      expect(mockSetPendingEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockSetPendingSignup).toHaveBeenCalledWith(request);
      expect(mockSetCustomer).toHaveBeenCalledWith(null);
      expect(mockedRouterPush).toHaveBeenCalledWith('/(auth)/verify');
    });
  });
});
