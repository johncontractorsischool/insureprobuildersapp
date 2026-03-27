import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CslbMomentumSignUpForm } from '@/screens/routes/auth/cslb-momentum-sign-up-form';
import { useAuth } from '@/context/auth-context';
import { useCslbMomentumSync } from '@/hooks/use-cslb-momentum-sync';
import { router } from 'expo-router';

jest.mock('@/hooks/use-cslb-momentum-sync', () => ({
  useCslbMomentumSync: jest.fn(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

const mockedUseCslbMomentumSync = useCslbMomentumSync as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedRouterPush = router.push as jest.Mock;

function mockHookState(overrides: Record<string, unknown> = {}) {
  mockedUseCslbMomentumSync.mockReturnValue({
    form: {
      firstName: '',
      lastName: '',
      email: '',
      licenseNumber: '',
      appFeeNumber: '',
      agentName: '',
    },
    errors: {},
    uiState: 'idle',
    isSubmitting: false,
    errorMessage: '',
    response: null,
    lastRequest: null,
    updateField: jest.fn(),
    validateField: jest.fn(),
    submit: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  });
}

describe('CslbMomentumSignUpForm', () => {
  const mockSetPendingEmail = jest.fn();
  const mockSetCustomer = jest.fn();

  beforeEach(() => {
    mockedRouterPush.mockReset();
    mockSetPendingEmail.mockReset();
    mockSetCustomer.mockReset();
    mockedUseAuth.mockReturnValue({
      setPendingEmail: mockSetPendingEmail,
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
          message: 'A matching Momentum record already exists.',
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

    render(<CslbMomentumSignUpForm />);

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

    render(<CslbMomentumSignUpForm />);

    expect(screen.getByText('Sync failed')).toBeTruthy();
    expect(screen.getByTestId('sync-error-message')).toHaveTextContent('Network request failed.');
  });

  it('shows Create Account action and hides agent name input', () => {
    mockHookState();

    render(<CslbMomentumSignUpForm />);

    expect(screen.getByText('Create Account')).toBeTruthy();
    expect(screen.queryByText('Agent Name (Optional)')).toBeNull();
  });

  it('navigates to verify when create account submit succeeds', async () => {
    const submit = jest.fn().mockResolvedValue({
      email: 'john@example.com',
      rateLimited: false,
    });
    mockHookState({ submit });

    render(<CslbMomentumSignUpForm />);

    fireEvent.press(screen.getByText('Create Account'));

    await waitFor(() => {
      expect(mockSetPendingEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockSetCustomer).toHaveBeenCalledWith(null);
      expect(mockedRouterPush).toHaveBeenCalledWith('/(auth)/verify');
    });
  });
});
