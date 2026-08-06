import React, { PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';

import { PoliciesProvider, usePolicies } from '@/context/policies-context';
import { buildCustomer, buildPolicy } from '@/tests/factories';

const mockUseAuth = jest.fn();
const mockFetchPoliciesByAccount = jest.fn();

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/policy-api', () => ({
  fetchPoliciesByAccount: (...args: unknown[]) => mockFetchPoliciesByAccount(...args),
}));

function wrapper({ children }: PropsWithChildren) {
  return <PoliciesProvider>{children}</PoliciesProvider>;
}

describe('PoliciesProvider', () => {
  it('loads policies for an authenticated customer database id', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userEmail: 'jane@example.com',
      customer: buildCustomer({ accountId: 'account-1' }),
    });
    mockFetchPoliciesByAccount.mockResolvedValue([buildPolicy()]);

    const { result } = renderHook(() => usePolicies(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingPolicies).toBe(false));

    expect(mockFetchPoliciesByAccount).toHaveBeenCalledWith('jane@example.com', 'account-1');
    expect(result.current.policies).toHaveLength(1);
    expect(result.current.policiesError).toBeNull();
  });

  it('surfaces a user-facing error when no database id is available', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userEmail: 'jane@example.com',
      customer: buildCustomer({ accountId: '', databaseId: '' }),
    });

    const { result } = renderHook(() => usePolicies(), { wrapper });

    await waitFor(() =>
      expect(result.current.policiesError).toBe('No PBIA account id is available for this account.')
    );

    expect(mockFetchPoliciesByAccount).not.toHaveBeenCalled();
    expect(result.current.policies).toEqual([]);
  });
});
