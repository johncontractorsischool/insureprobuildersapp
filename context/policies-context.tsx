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
import { fetchPoliciesByAccount } from '@/services/policy-api';
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
  const { isAuthenticated, customer, userEmail } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);

  const accountId = useMemo(
    () => customer?.accountId?.trim() || customer?.databaseId?.trim() || '',
    [customer?.accountId, customer?.databaseId]
  );

  const refreshPolicies = useCallback(async () => {
    if (!isAuthenticated) {
      setPolicies([]);
      setPoliciesError(null);
      setIsLoadingPolicies(false);
      return;
    }

    if (!accountId || !userEmail) {
      setPolicies([]);
      setPoliciesError('No PBIA account id is available for this account.');
      setIsLoadingPolicies(false);
      return;
    }

    setIsLoadingPolicies(true);
    setPoliciesError(null);
    try {
      const fetched = await fetchPoliciesByAccount(userEmail, accountId);
      setPolicies(fetched);
    } catch (error) {
      setPolicies([]);
      setPoliciesError(toUserFacingError(error));
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [accountId, isAuthenticated, userEmail]);

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
