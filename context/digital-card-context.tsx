import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import {
  getDigitalBusinessCard,
  publishDigitalBusinessCard,
  updateDigitalBusinessCard,
} from '@/services/digital-card-api';
import type { DigitalBusinessCard, DigitalCardDraft } from '@/types/digital-card';
import { getDigitalCardOwnerId, normalizeDigitalCardDraft } from '@/utils/digital-card-validation';
import { getDigitalCardDraftStorageKey } from '@/hooks/use-digital-card-draft';

type DigitalCardContextValue = {
  card: DigitalBusinessCard | null;
  hasDraft: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshDraftStatus: () => Promise<void>;
  publish: (draft: DigitalCardDraft) => Promise<DigitalBusinessCard>;
  update: (draft: DigitalCardDraft) => Promise<DigitalBusinessCard>;
};

const DigitalCardContext = createContext<DigitalCardContextValue | undefined>(undefined);

export function DigitalCardProvider({ children }: PropsWithChildren) {
  const { customer, userEmail, isAuthenticated } = useAuth();
  const ownerId = getDigitalCardOwnerId(customer, userEmail);
  const [card, setCard] = useState<DigitalBusinessCard | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDraftStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setHasDraft(false);
      return;
    }

    const raw = await AsyncStorage.getItem(getDigitalCardDraftStorageKey(ownerId));
    setHasDraft(Boolean(raw));
  }, [isAuthenticated, ownerId]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCard(null);
      setHasDraft(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextCard = await getDigitalBusinessCard(ownerId);
      setCard(nextCard);
      await refreshDraftStatus();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Unable to load your digital business card right now.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, ownerId, refreshDraftStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const publish = useCallback(
    async (draft: DigitalCardDraft) => {
      setIsSaving(true);
      setError(null);
      try {
        const nextCard = await publishDigitalBusinessCard(ownerId, normalizeDigitalCardDraft(draft));
        setCard(nextCard);
        setHasDraft(false);
        return nextCard;
      } catch (caughtError) {
        const message =
          caughtError instanceof Error && caughtError.message
            ? caughtError.message
            : 'Unable to publish your digital business card right now.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [ownerId]
  );

  const update = useCallback(
    async (draft: DigitalCardDraft) => {
      setIsSaving(true);
      setError(null);
      try {
        const nextCard = await updateDigitalBusinessCard(ownerId, normalizeDigitalCardDraft(draft));
        setCard(nextCard);
        setHasDraft(false);
        return nextCard;
      } catch (caughtError) {
        const message =
          caughtError instanceof Error && caughtError.message
            ? caughtError.message
            : 'Unable to update your digital business card right now.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [ownerId]
  );

  const value = useMemo<DigitalCardContextValue>(
    () => ({
      card,
      hasDraft,
      isLoading,
      isSaving,
      error,
      refresh,
      refreshDraftStatus,
      publish,
      update,
    }),
    [card, error, hasDraft, isLoading, isSaving, publish, refresh, refreshDraftStatus, update]
  );

  return <DigitalCardContext.Provider value={value}>{children}</DigitalCardContext.Provider>;
}

export function useDigitalCard() {
  const context = useContext(DigitalCardContext);
  if (!context) {
    throw new Error('useDigitalCard must be used inside DigitalCardProvider');
  }
  return context;
}
