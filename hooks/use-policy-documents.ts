import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { PbiaApiError } from '@/services/pbia-client';
import { fetchClientDocuments, fetchClientPolicyDocuments } from '@/services/policy-files-api';
import type { PolicyFileEntry } from '@/types/policy-file';
import {
  hasVisiblePolicyDocumentName,
  matchesSelectedPolicyFile,
  mergePolicyFiles,
} from '@/utils/policy-files';

type DocumentScope = {
  accountId: string;
  policyId: string;
  policyNumber: string;
  folderId?: string;
  userEmail: string | null;
  scopeError: string | null;
};

type DocumentState = {
  scope: string;
  files: PolicyFileEntry[];
  page: number;
  totalPages: number;
  partial: boolean;
  loading: 'initial' | 'refresh' | 'more' | null;
  error: string | null;
  moreError: string | null;
};

export function isDocumentAccessDenied(error: unknown) {
  return error instanceof PbiaApiError && [401, 403, 404].includes(error.status);
}

export function usePolicyDocuments(input: DocumentScope) {
  const { accountId, policyId, policyNumber, folderId, userEmail, scopeError } = input;
  const scope = JSON.stringify([
    accountId,
    policyId,
    policyNumber,
    folderId,
    userEmail,
    scopeError,
  ]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const requestId = useRef(0);
  const initial = useCallback(
    (): DocumentState => ({
      scope,
      files: [],
      page: 0,
      totalPages: 0,
      partial: false,
      loading: 'initial',
      error: null,
      moreError: null,
    }),
    [scope]
  );
  const [snapshot, setSnapshot] = useState<DocumentState>(initial);
  const state = snapshot.scope === scope ? snapshot : initial();
  const stateRef = useRef(state);
  stateRef.current = state;
  const busy = useRef(false);

  const invalidate = useCallback(
    (message: string) => {
      requestId.current += 1;
      busy.current = false;
      setSnapshot({ ...initial(), loading: null, error: message });
    },
    [initial]
  );

  const load = useCallback(
    async (page: number, refresh = false) => {
      const request = ++requestId.current;
      const current = () => activeScope.current === scope && request === requestId.current;
      const previous = stateRef.current;
      const base = initial();
      if (scopeError || !accountId || !userEmail) {
        setSnapshot({
          ...base,
          loading: null,
          error: scopeError ?? 'No account is available to load documents.',
        });
        return;
      }
      busy.current = true;
      setSnapshot({
        ...(page > 1 ? previous : base),
        loading: page > 1 ? 'more' : refresh ? 'refresh' : 'initial',
        moreError: null,
      });
      try {
        const query = { accountId, folderId, page };
        const result = policyId
          ? await fetchClientPolicyDocuments(userEmail, { ...query, policyId })
          : await fetchClientDocuments(userEmail, query);
        if (!current()) return;
        // A changed source set changes page boundaries. Restart through Refresh rather than mixing them.
        if (page > 1 && result.partial !== previous.partial) {
          setSnapshot({
            ...previous,
            loading: null,
            partial: true,
            totalPages: previous.page,
            moreError: 'Document availability changed. Refresh to reload the list.',
          });
          return;
        }
        const visible = result.data.filter(
          (entry) =>
            hasVisiblePolicyDocumentName(entry.name) &&
            matchesSelectedPolicyFile(entry, policyId, policyNumber)
        );
        setSnapshot({
          ...base,
          loading: null,
          files: mergePolicyFiles(page > 1 ? previous.files : [], visible),
          page: result.page,
          totalPages: result.totalPages,
          partial: result.partial,
        });
      } catch (error) {
        if (!current()) return;
        const message =
          error instanceof Error ? error.message : 'Unable to load policy files right now.';
        if (page > 1 && !isDocumentAccessDenied(error)) {
          setSnapshot({ ...previous, loading: null, moreError: message });
        } else {
          setSnapshot({ ...base, loading: null, error: message });
        }
      } finally {
        if (current()) busy.current = false;
      }
    },
    [accountId, folderId, initial, policyId, policyNumber, scope, scopeError, userEmail]
  );

  useFocusEffect(
    useCallback(() => {
      void load(1);
      return () => {
        requestId.current += 1;
        busy.current = false;
      };
    }, [load])
  );

  const refresh = useCallback(() => load(1, true), [load]);
  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (busy.current || current.loading || current.page >= current.totalPages) return;
    void load(current.page + 1);
  }, [load]);

  return { ...state, scope, refresh, loadMore, invalidate };
}
