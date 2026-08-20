import React, { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '@/context/auth-context';
import { PbiaApiError } from '@/services/pbia-client';
import { buildCustomerLookupRecord } from '@/tests/factories';

const mockGetSupabaseClient = jest.fn();
const mockResolveMyAccount = jest.fn();
const mockResolveMyAccountByLicense = jest.fn();
const mockGetPortalConfig = jest.fn();

type MockAuthSession = { user: { email: string } } | null;
type MockAuthChangeHandler = (
  event: string,
  session: MockAuthSession
) => void | Promise<void>;

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));
jest.mock('@/services/customer-api', () => ({
  resolveMyAccount: (...args: unknown[]) => mockResolveMyAccount(...args),
  resolveMyAccountByLicense: (...args: unknown[]) =>
    mockResolveMyAccountByLicense(...args),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => mockGetPortalConfig(),
}));

function createSupabaseMock({
  sessionEmail = null,
  portalRows = [],
}: {
  sessionEmail?: string | null;
  portalRows?: Record<string, unknown>[];
}) {
  const signOut = jest.fn().mockResolvedValue(undefined);
  const unsubscribe = jest.fn();
  let authChangeHandler: MockAuthChangeHandler | null = null;
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order
    .mockImplementationOnce(() => query)
    .mockImplementationOnce(() => Promise.resolve({ data: portalRows, error: null }));

  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: sessionEmail
            ? {
                user: {
                  email: sessionEmail,
                },
              }
            : null,
        },
      }),
      onAuthStateChange: jest.fn((handler: MockAuthChangeHandler) => {
        authChangeHandler = handler;
        return {
          data: {
            subscription: {
              unsubscribe,
            },
          },
        };
      }),
      signOut,
    },
    from: jest.fn(() => query),
    __query: query,
    __unsubscribe: unsubscribe,
    __signOut: signOut,
    __emitAuthChange: async (event: string, email: string | null) => {
      if (!authChangeHandler) throw new Error('Auth listener is not registered.');
      await authChangeHandler(event, email ? { user: { email } } : null);
    },
  };
}

function wrapper({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockGetPortalConfig.mockReturnValue({
      demo: { enabled: false, profile: null, data: null },
      review: { enabled: false, email: null, code: null, data: null },
    });
    mockResolveMyAccount.mockReset();
    mockResolveMyAccountByLicense.mockReset();
  });

  it('hydrates the current session from the live customer lookup when it is available', async () => {
    const supabaseMock = createSupabaseMock({
      sessionEmail: 'jane@example.com',
    });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    mockResolveMyAccount.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 1,
      account: buildCustomerLookupRecord(),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.userEmail).toBe('jane@example.com');
    expect(result.current.pendingEmail).toBe('jane@example.com');
    expect(result.current.pendingInsuredId).toBe('LIC-123456');
    expect(result.current.customer).toEqual(
      expect.objectContaining({
        databaseId: 'insured-db-1',
        insuredId: 'LIC-123456',
        type: 1,
        fullName: 'Jane Builder',
        addressLine1: '123 Main St',
        city: 'Los Angeles',
        stateNameOrAbbreviation: 'CA',
        zipCode: '90001',
        smsPhone: '5559990000',
      })
    );
    expect(mockResolveMyAccount).toHaveBeenCalledWith('jane@example.com');
  });

  it('hydrates the previously selected license when the session email owns multiple accounts', async () => {
    await AsyncStorage.setItem(
      'portal_selected_customer',
      JSON.stringify({
        email: 'jane@example.com',
        insuredId: 'LIC-222222',
      })
    );

    const supabaseMock = createSupabaseMock({
      sessionEmail: 'jane@example.com',
    });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    const selectedCustomer = buildCustomerLookupRecord({
      databaseId: 'insured-db-2',
      licenseNumber: 'LIC-222222',
      insuredId: 'LIC-222222',
      commercialName: 'Second Builder Co',
      firstName: 'John',
      lastName: 'Builder',
    });
    mockResolveMyAccount.mockResolvedValue({ status: 'LICENSE_REQUIRED', matchCount: 2 });
    mockResolveMyAccountByLicense.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 2,
      account: selectedCustomer,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    expect(result.current.pendingInsuredId).toBe('LIC-222222');
    expect(mockResolveMyAccountByLicense).toHaveBeenCalledWith(
      'jane@example.com',
      'LIC-222222'
    );
    expect(result.current.customer).toEqual(
      expect.objectContaining({
        databaseId: 'insured-db-2',
        insuredId: 'LIC-222222',
        fullName: 'John Builder',
      })
    );
  });

  it('does not choose an arbitrary account when no stored license resolves multiple matches', async () => {
    const supabaseMock = createSupabaseMock({
      sessionEmail: 'jane@example.com',
    });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    mockResolveMyAccount.mockResolvedValue({ status: 'LICENSE_REQUIRED', matchCount: 2 });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    expect(result.current.userEmail).toBe('jane@example.com');
    expect(result.current.customer).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockResolveMyAccountByLicense).not.toHaveBeenCalled();
  });

  it('clears an invalid stored selection without restoring a stale cached account', async () => {
    await AsyncStorage.setItem(
      'portal_selected_customer',
      JSON.stringify({ email: 'jane@example.com', insuredId: 'LIC-OLD' })
    );
    const supabaseMock = createSupabaseMock({
      sessionEmail: 'jane@example.com',
      portalRows: [
        {
          database_id: 'stale-account',
          commercial_name: 'Stale Builder Co',
          email: 'jane@example.com',
          insured_id: 'LIC-OLD',
          is_active: true,
        },
      ],
    });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    mockResolveMyAccount.mockResolvedValue({ status: 'LICENSE_REQUIRED', matchCount: 2 });
    mockResolveMyAccountByLicense.mockRejectedValue(
      new PbiaApiError(404, 'Client account could not be resolved')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    expect(result.current.customer).toBeNull();
    expect(result.current.pendingInsuredId).toBe('');
    expect(supabaseMock.from).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(AsyncStorage.getItem('portal_selected_customer')).resolves.toBeNull()
    );
  });

  it('finishes restoring the session when the live customer lookup never responds', async () => {
    jest.useFakeTimers();
    try {
      const supabaseMock = createSupabaseMock({
        sessionEmail: 'jane@example.com',
      });
      mockGetSupabaseClient.mockReturnValue(supabaseMock);
      mockResolveMyAccount.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(mockResolveMyAccount).toHaveBeenCalled());
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isLoadingAuth).toBe(false);
      expect(result.current.customer).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to cached portal_customers rows when the live customer lookup fails', async () => {
    const supabaseMock = createSupabaseMock({
      sessionEmail: 'jane@example.com',
      portalRows: [
        {
          database_id: 'insured-db-1',
          commercial_name: 'Builder Co',
          first_name: 'Jane',
          last_name: 'Builder',
          source_payload: {
            type: 0,
            addressLine1: '123 Main St',
            city: 'Los Angeles',
            stateNameOrAbbreviation: 'CA',
            zipCode: '90001',
            smsPhone: '5559990000',
            website: 'https://builder.example.com',
            fein: '12-3456789',
          },
          email: 'jane@example.com',
          phone: '5551112222',
          cell_phone: '5559990000',
          customer_id: 'customer-1',
          insured_id: 'LIC-123456',
          is_active: true,
        },
      ],
    });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    mockResolveMyAccount.mockRejectedValue(new Error('lookup unavailable'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    expect(result.current.customer).toEqual(
      expect.objectContaining({
        databaseId: 'insured-db-1',
        insuredId: 'LIC-123456',
        type: 0,
        fullName: 'Jane Builder',
        addressLine1: '123 Main St',
        city: 'Los Angeles',
        stateNameOrAbbreviation: 'CA',
        zipCode: '90001',
        smsPhone: '5559990000',
        website: 'https://builder.example.com',
        fein: '12-3456789',
      })
    );
    expect(supabaseMock.from).toHaveBeenCalledWith('portal_customers');
  });

  it('completeSignIn stores the normalized email and supplied customer', async () => {
    mockGetSupabaseClient.mockReturnValue(createSupabaseMock({}));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    act(() => {
      result.current.completeSignIn('  Jane@Example.com ', {
        insuredId: 'LIC-123456',
        fullName: 'Jane Builder',
      });
    });

    expect(result.current.userEmail).toBe('jane@example.com');
    expect(result.current.pendingEmail).toBe('jane@example.com');
    expect(result.current.pendingInsuredId).toBe('LIC-123456');
    expect(result.current.customer).toEqual(
      expect.objectContaining({
        email: 'jane@example.com',
        insuredId: 'LIC-123456',
      })
    );
  });

  it('keeps OTP sessions pending until account selection completes without clearing later sessions', async () => {
    const supabaseMock = createSupabaseMock({});
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    mockResolveMyAccount.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 1,
      account: buildCustomerLookupRecord(),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    act(() => {
      result.current.setPendingEmail('jane@example.com');
    });
    await act(async () => {
      await supabaseMock.__emitAuthChange('SIGNED_IN', 'jane@example.com');
    });

    expect(result.current.userEmail).toBe('jane@example.com');
    expect(result.current.customer).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockResolveMyAccount).not.toHaveBeenCalled();

    act(() => {
      result.current.completeSignIn('jane@example.com', {
        insuredId: 'LIC-123456',
        fullName: 'Jane Builder',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await supabaseMock.__emitAuthChange('SIGNED_IN', 'jane@example.com');
    });

    expect(result.current.customer).toEqual(
      expect.objectContaining({ insuredId: 'LIC-123456' })
    );
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('restores a configured demo session without a Supabase session', async () => {
    await AsyncStorage.setItem(
      'portal_review_session',
      JSON.stringify({
        email: 'demo@insureprobuilders.com',
        insuredId: '101000937',
      })
    );

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

    mockGetSupabaseClient.mockReturnValue(createSupabaseMock({}));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.userEmail).toBe('demo@insureprobuilders.com');
    expect(result.current.pendingEmail).toBe('demo@insureprobuilders.com');
    expect(result.current.pendingInsuredId).toBe('101000937');
    expect(result.current.customer).toEqual(
      expect.objectContaining({
        insuredId: '101000937',
        commercialName: 'UrbanEdge Construction Inc.',
      })
    );
    expect(mockResolveMyAccount).not.toHaveBeenCalled();
  });

  it('persists a configured demo sign-in and clears it on sign-out', async () => {
    mockGetPortalConfig.mockReturnValue({
      demo: { enabled: false, profile: 'marketing', data: null },
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
    mockGetSupabaseClient.mockReturnValue(createSupabaseMock({}));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    act(() => {
      result.current.completeSignIn(
        'demo@insureprobuilders.com',
        {
          email: 'demo@insureprobuilders.com',
          insuredId: '101000937',
          commercialName: 'UrbanEdge Construction Inc.',
        },
        '101000937'
      );
    });

    await waitFor(async () => {
      expect(await AsyncStorage.getItem('portal_review_session')).toBe(
        JSON.stringify({
          email: 'demo@insureprobuilders.com',
          insuredId: '101000937',
        })
      );
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(await AsyncStorage.getItem('portal_review_session')).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('signOut clears the local auth state even if Supabase resolves normally', async () => {
    const supabaseMock = createSupabaseMock({ sessionEmail: 'jane@example.com' });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    mockResolveMyAccount.mockResolvedValue({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 1,
      account: buildCustomerLookupRecord(),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabaseMock.__signOut).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userEmail).toBeNull();
    expect(result.current.pendingEmail).toBe('');
    expect(result.current.pendingInsuredId).toBe('');
    expect(result.current.customer).toBeNull();
  });
});
