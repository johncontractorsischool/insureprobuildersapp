import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { DigitalCardDraft } from '@/types/digital-card';

const DRAFT_KEY_PREFIX = 'digital-business-card-draft-v1:';

export function getDigitalCardDraftStorageKey(ownerId: string) {
  return `${DRAFT_KEY_PREFIX}${ownerId}`;
}

export function useDigitalCardDraft(ownerId: string, initialDraft: DigitalCardDraft) {
  const [draft, setDraft] = useState(initialDraft);
  const [isHydratingDraft, setIsHydratingDraft] = useState(true);
  const [hasPersistedDraft, setHasPersistedDraft] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      setIsHydratingDraft(true);
      try {
        const raw = await AsyncStorage.getItem(getDigitalCardDraftStorageKey(ownerId));
        if (!mounted) return;
        if (raw) {
          setDraft({
            ...initialDraft,
            ...(JSON.parse(raw) as Partial<DigitalCardDraft>),
            templateId: 'insurepro-classic',
          });
          setHasPersistedDraft(true);
        } else {
          setDraft(initialDraft);
          setHasPersistedDraft(false);
        }
      } catch {
        if (mounted) {
          setDraft(initialDraft);
          setHasPersistedDraft(false);
        }
      } finally {
        if (mounted) setIsHydratingDraft(false);
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, [initialDraft, ownerId]);

  const persistDraft = useCallback(
    async (nextDraft: DigitalCardDraft) => {
      setDraft(nextDraft);
      setHasPersistedDraft(true);
      await AsyncStorage.setItem(getDigitalCardDraftStorageKey(ownerId), JSON.stringify(nextDraft));
    },
    [ownerId]
  );

  const clearDraft = useCallback(async () => {
    setHasPersistedDraft(false);
    await AsyncStorage.removeItem(getDigitalCardDraftStorageKey(ownerId));
  }, [ownerId]);

  return {
    draft,
    setDraft,
    persistDraft,
    clearDraft,
    isHydratingDraft,
    hasPersistedDraft,
  };
}
