import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/auth-context';
import { fetchPoliciesByInsuredDatabaseId } from '@/services/policy-api';
import { Policy } from '@/types/policy';

type PoliciesContextValue = {
  policies: Policy[];
  isLoadingPolicies: boolean;
  policiesError: string | null;
  refreshPolicies: () => Promise<void>;
};

const PoliciesContext = createContext<PoliciesContextValue | undefined>(undefined);

function toUserFacingError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to load your policies right now.';
}

export function PoliciesProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, customer } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);

  // `getPolicy?IId=` expects the customer databaseId from getCustomer.
  const policyLookupId = useMemo(() => customer?.databaseId?.trim() || '', [customer?.databaseId]);

  const refreshPolicies = useCallback(async () => {
    if (!isAuthenticated) {
      setPolicies([]);
      setPoliciesError(null);
      setIsLoadingPolicies(false);
      return;
    }

    if (!policyLookupId) {
      setPolicies([]);
      setPoliciesError('No customer database id is available for this account.');
      setIsLoadingPolicies(false);
      return;
    }

    setIsLoadingPolicies(true);
    setPoliciesError(null);
    try {
      const fetched = await fetchPoliciesByInsuredDatabaseId(policyLookupId);
      setPolicies(fetched);
    } catch (error) {
      setPolicies([]);
      setPoliciesError(toUserFacingError(error));
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [isAuthenticated, policyLookupId]);

  useEffect(() => {
    void refreshPolicies();
  }, [refreshPolicies]);

  const value = useMemo<PoliciesContextValue>(
    () => ({
      policies,
      isLoadingPolicies,
      policiesError,
      refreshPolicies,
    }),
    [isLoadingPolicies, policies, policiesError, refreshPolicies]
  );

  return <PoliciesContext.Provider value={value}>{children}</PoliciesContext.Provider>;
}

export function usePolicies() {
  const context = useContext(PoliciesContext);
  if (!context) {
    throw new Error('usePolicies must be used inside PoliciesProvider.');
  }

  return context;
}
