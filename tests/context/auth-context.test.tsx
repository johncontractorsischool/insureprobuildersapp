import React, { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '@/context/auth-context';
import { buildCustomerLookupRecord } from '@/tests/factories';

const mockGetSupabaseClient = jest.fn();
const mockFetchCustomersByEmail = jest.fn();
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

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));
jest.mock('@/services/customer-api', () => ({
  fetchCustomersByEmail: (...args: unknown[]) => mockFetchCustomersByEmail(...args),
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
      onAuthStateChange: jest.fn(() => ({
        data: {
          subscription: {
            unsubscribe,
          },
        },
      })),
      signOut,
    },
    from: jest.fn(() => query),
    __query: query,
    __unsubscribe: unsubscribe,
    __signOut: signOut,
  };
}

function wrapper({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
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

  it('hydrates the current session from the live customer lookup when it is available', async () => {
    const supabaseMock = createSupabaseMock({
      sessionEmail: 'jane@example.com',
    });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
    mockFetchCustomersByEmail.mockResolvedValue([buildCustomerLookupRecord()]);

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
    expect(mockFetchCustomersByEmail).toHaveBeenCalledWith('jane@example.com');
  });

  it('hydrates the preferred customer when a persisted insuredId exists for the signed-in email', async () => {
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
    mockFetchCustomersByEmail.mockResolvedValue([
      buildCustomerLookupRecord({
        insuredId: 'LIC-111111',
        commercialName: 'First Builder Co',
        firstName: 'Jane',
        lastName: 'Builder',
      }),
      buildCustomerLookupRecord({
        databaseId: 'insured-db-2',
        insuredId: 'LIC-222222',
        commercialName: 'Second Builder Co',
        firstName: 'John',
        lastName: 'Builder',
      }),
    ]);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingAuth).toBe(false));

    expect(result.current.pendingInsuredId).toBe('LIC-222222');
    expect(result.current.customer).toEqual(
      expect.objectContaining({
        databaseId: 'insured-db-2',
        insuredId: 'LIC-222222',
        fullName: 'John Builder',
      })
    );
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
    mockFetchCustomersByEmail.mockRejectedValue(new Error('lookup unavailable'));

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

  it('restores the Apple review demo session when no Supabase session exists', async () => {
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
        profile: null,
        data: null,
      },
      review: {
        enabled: true,
        email: 'demo@insureprobuilders.com',
        code: '111111',
      },
    });
    mockGetSupabaseClient.mockReturnValue(createSupabaseMock({}));
    mockFetchCustomersByEmail.mockResolvedValue([
      buildCustomerLookupRecord({
        eMail: 'demo@insureprobuilders.com',
        insuredId: '101000937',
        commercialName: 'UrbanEdge Construction Inc.',
      }),
    ]);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    expect(result.current.isLoadingAuth).toBe(false);
    expect(result.current.userEmail).toBe('demo@insureprobuilders.com');
    expect(result.current.pendingEmail).toBe('demo@insureprobuilders.com');
    expect(result.current.pendingInsuredId).toBe('101000937');
    expect(result.current.customer).toEqual(
      expect.objectContaining({
        commercialName: 'UrbanEdge Construction Inc.',
        email: 'demo@insureprobuilders.com',
        insuredId: '101000937',
      })
    );
    expect(mockFetchCustomersByEmail).toHaveBeenCalledWith('demo@insureprobuilders.com');
  });

  it('signOut clears the local auth state even if Supabase resolves normally', async () => {
    const supabaseMock = createSupabaseMock({ sessionEmail: 'jane@example.com' });
    mockGetSupabaseClient.mockReturnValue(supabaseMock);
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
