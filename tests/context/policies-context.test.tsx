import React, { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

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
  beforeEach(() => {
    mockFetchPoliciesByAccount.mockReset();
    mockUseAuth.mockReturnValue({ isAuthenticated: true, userEmail: 'jane@example.com', customer: buildCustomer({ accountId: 'account-1' }) });
  });

  it('replaces policies on refresh and preserves a retryable failure', async () => {
    mockFetchPoliciesByAccount.mockResolvedValueOnce([buildPolicy()]).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Unavailable'));
    const { result } = renderHook(() => usePolicies(), { wrapper });
    await waitFor(() => expect(result.current.policies).toHaveLength(1));
    await act(async () => result.current.refreshPolicies());
    expect(result.current.policies).toEqual([]);
    expect(result.current.policiesError).toBeNull();
    await act(async () => result.current.refreshPolicies());
    expect(result.current.policiesError).toBe('Unavailable');
    mockFetchPoliciesByAccount.mockResolvedValueOnce([buildPolicy()]);
    await act(async () => result.current.refreshPolicies());
    expect(result.current.policies).toHaveLength(1);
    expect(result.current.policiesError).toBeNull();
  });

  it('ignores a late response for the previous account', async () => {
    let resolve!: (policies: ReturnType<typeof buildPolicy>[]) => void;
    mockFetchPoliciesByAccount.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(() => usePolicies(), { wrapper });
    mockUseAuth.mockReturnValue({ isAuthenticated: true, userEmail: 'jane@example.com', customer: buildCustomer({ accountId: 'account-2' }) });
    mockFetchPoliciesByAccount.mockResolvedValueOnce([buildPolicy({ id: 'new-account' })]);
    rerender({});
    await waitFor(() => expect(result.current.policies[0]?.id).toBe('new-account'));
    await act(async () => resolve([buildPolicy({ id: 'old-account' })]));
    expect(result.current.policies.map((policy) => policy.id)).toEqual(['new-account']);
  });

  it('does not restore a removed policy from an older overlapping refresh', async () => {
    mockFetchPoliciesByAccount.mockResolvedValueOnce([buildPolicy()]);
    const { result } = renderHook(() => usePolicies(), { wrapper });
    await waitFor(() => expect(result.current.policies).toHaveLength(1));
    let resolve!: (policies: ReturnType<typeof buildPolicy>[]) => void;
    mockFetchPoliciesByAccount.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValueOnce([]);
    let older!: Promise<void>;
    act(() => { older = result.current.refreshPolicies(); });
    await act(async () => result.current.refreshPolicies());
    await act(async () => { resolve([buildPolicy()]); await older; });
    expect(result.current.policies).toEqual([]);
  });

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
