import React, { PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';

import { PoliciesProvider, usePolicies } from '@/context/policies-context';
import { buildCustomer, buildPolicy } from '@/tests/factories';

const mockUseAuth = jest.fn();
const mockFetchPoliciesByInsuredDatabaseId = jest.fn();

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/policy-api', () => ({
  fetchPoliciesByInsuredDatabaseId: (...args: unknown[]) =>
    mockFetchPoliciesByInsuredDatabaseId(...args),
}));

function wrapper({ children }: PropsWithChildren) {
  return <PoliciesProvider>{children}</PoliciesProvider>;
}

describe('PoliciesProvider', () => {
  it('loads policies for an authenticated customer database id', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      customer: buildCustomer({ databaseId: 'insured-db-1' }),
    });
    mockFetchPoliciesByInsuredDatabaseId.mockResolvedValue([buildPolicy()]);

    const { result } = renderHook(() => usePolicies(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingPolicies).toBe(false));

    expect(mockFetchPoliciesByInsuredDatabaseId).toHaveBeenCalledWith('insured-db-1');
    expect(result.current.policies).toHaveLength(1);
    expect(result.current.policiesError).toBeNull();
  });

  it('surfaces a user-facing error when no database id is available', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      customer: buildCustomer({ databaseId: '' }),
    });

    const { result } = renderHook(() => usePolicies(), { wrapper });

    await waitFor(() =>
      expect(result.current.policiesError).toBe('No customer database id is available for this account.')
    );

    expect(mockFetchPoliciesByInsuredDatabaseId).not.toHaveBeenCalled();
    expect(result.current.policies).toEqual([]);
  });
});
