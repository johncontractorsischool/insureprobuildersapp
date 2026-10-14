import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const accountId = customer?.accountId?.trim() || customer?.databaseId?.trim() || '';
  const scope = JSON.stringify([isAuthenticated, accountId, userEmail]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const requestId = useRef(0);
  const [snapshot, setSnapshot] = useState({
    scope,
    policies: [] as Policy[],
    isLoadingPolicies: false,
    policiesError: null as string | null,
  });

  const refreshPolicies = useCallback(async () => {
    const request = ++requestId.current;
    const isCurrent = () => request === requestId.current && scope === currentScope.current;
    const empty = { scope, policies: [] as Policy[], isLoadingPolicies: false, policiesError: null };
    if (!isAuthenticated) {
      setSnapshot(empty);
      return;
    }
    if (!accountId || !userEmail) {
      setSnapshot({ ...empty, policiesError: 'No PBIA account id is available for this account.' });
      return;
    }

    setSnapshot({ ...empty, isLoadingPolicies: true });
    try {
      const policies = await fetchPoliciesByAccount(userEmail, accountId);
      if (isCurrent()) setSnapshot({ ...empty, policies });
    } catch (error) {
      if (isCurrent()) setSnapshot({ ...empty, policiesError: toUserFacingError(error) });
    }
  }, [accountId, isAuthenticated, scope, userEmail]);

  useEffect(() => {
    void refreshPolicies();
    return () => { requestId.current += 1; };
  }, [refreshPolicies]);

  const value = useMemo<PoliciesContextValue>(() => ({
    policies: snapshot.scope === scope ? snapshot.policies : [],
    isLoadingPolicies: snapshot.scope === scope ? snapshot.isLoadingPolicies : isAuthenticated,
    policiesError: snapshot.scope === scope ? snapshot.policiesError : null,
    refreshPolicies,
  }), [isAuthenticated, refreshPolicies, scope, snapshot]);

  return <PoliciesContext.Provider value={value}>{children}</PoliciesContext.Provider>;
}

export function usePolicies() {
  const context = useContext(PoliciesContext);
  if (!context) {
    throw new Error('usePolicies must be used inside PoliciesProvider.');
  }

  return context;
}
