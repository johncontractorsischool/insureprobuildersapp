import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchNextRoundRobinAgentName,
  getNextRoundRobinAgentName,
  recordAssignedAgentName,
} from '@/services/agent-round-robin';
import { isOtpRateLimitError, sendEmailSignInCode } from '@/services/auth-flow';
import {
  CslbMomentumSyncRequest,
  CslbMomentumSyncSuccessResponse,
  syncCslbMomentum,
} from '@/services/cslb-momentum-sync-api';
import { upsertSignupAccount } from '@/services/signup-account';

const AGENT_NAME_STORAGE_KEY = 'cslb-momentum-sync-agent-name-v1';
export type SignupIdentifierType = 'license' | 'appFee';

export type CslbMomentumSyncForm = {
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
  appFeeNumber: string;
  agentName: string;
};

export type CslbMomentumSyncFormField = keyof CslbMomentumSyncForm;
export type CslbMomentumSyncValidationErrors = Partial<Record<CslbMomentumSyncFormField, string>>;
export type CslbMomentumSyncUiState = 'idle' | 'loading' | 'success' | 'error';
export type CslbMomentumSyncSubmitResult = {
  email: string;
  rateLimited: boolean;
};

export const CSLB_MOMENTUM_SYNC_DEFAULT_FORM: CslbMomentumSyncForm = {
  firstName: '',
  lastName: '',
  email: '',
  licenseNumber: '',
  appFeeNumber: '',
  agentName: '',
};

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeCslbMomentumSyncForm(form: CslbMomentumSyncForm): CslbMomentumSyncForm {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    licenseNumber: form.licenseNumber.trim(),
    appFeeNumber: form.appFeeNumber.trim(),
    agentName: form.agentName.trim(),
  };
}

export function validateCslbMomentumSyncForm(
  form: CslbMomentumSyncForm
): CslbMomentumSyncValidationErrors {
  const errors: CslbMomentumSyncValidationErrors = {};

  if (!form.firstName) {
    errors.firstName = 'First name is required.';
  }
  if (!form.lastName) {
    errors.lastName = 'Last name is required.';
  }
  if (!form.email) {
    errors.email = 'Email is required.';
  } else if (!isEmailValid(form.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!form.licenseNumber && !form.appFeeNumber) {
    const message = 'Enter a license number or app fee number.';
    errors.licenseNumber = message;
    errors.appFeeNumber = message;
  }

  return errors;
}

export function buildCslbMomentumSyncRequest(form: CslbMomentumSyncForm): CslbMomentumSyncRequest {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    // Backend should prefer app fee number when both values are entered.
    licenseNumber: form.appFeeNumber ? '' : form.licenseNumber,
    appFeeNumber: form.appFeeNumber,
    agentName: form.agentName,
  };
}

export function useCslbMomentumSync() {
  const [identifierType, setIdentifierType] = useState<SignupIdentifierType>('license');
  const [savedAgentName, setSavedAgentName] = useState('');
  const [form, setForm] = useState<CslbMomentumSyncForm>(CSLB_MOMENTUM_SYNC_DEFAULT_FORM);
  const [errors, setErrors] = useState<CslbMomentumSyncValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [response, setResponse] = useState<CslbMomentumSyncSuccessResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<CslbMomentumSyncRequest | null>(null);

  useEffect(() => {
    let mounted = true;

    const hydrateAssignedAgentName = async () => {
      let storedAgentName = '';

      try {
        const stored = await AsyncStorage.getItem(AGENT_NAME_STORAGE_KEY);
        storedAgentName = stored?.trim() ?? '';
      } catch {
        // Agent name persistence is optional. Ignore read failures.
      }

      let nextAssignedAgent = '';
      try {
        nextAssignedAgent = await fetchNextRoundRobinAgentName();
      } catch {
        nextAssignedAgent = getNextRoundRobinAgentName(storedAgentName);
      }

      if (!mounted) return;

      setSavedAgentName(nextAssignedAgent);
      setForm((previous) =>
        previous.agentName
          ? previous
          : {
              ...previous,
              agentName: nextAssignedAgent,
            }
      );
    };

    void hydrateAssignedAgentName();

    return () => {
      mounted = false;
    };
  }, []);

  const updateField = useCallback((field: CslbMomentumSyncFormField, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrorMessage('');
    setErrors((previous) => {
      if (!previous[field] && field !== 'licenseNumber' && field !== 'appFeeNumber') return previous;

      const next = { ...previous };
      delete next[field];
      if (field === 'licenseNumber' || field === 'appFeeNumber') {
        delete next.licenseNumber;
        delete next.appFeeNumber;
      }
      return next;
    });
  }, []);

  const setIdentifierValue = useCallback(
    (value: string) => {
      if (identifierType === 'license') {
        setForm((previous) => ({
          ...previous,
          licenseNumber: value,
          appFeeNumber: '',
        }));
        setErrors((previous) => {
          const next = { ...previous };
          delete next.licenseNumber;
          delete next.appFeeNumber;
          return next;
        });
        return;
      }

      setForm((previous) => ({
        ...previous,
        appFeeNumber: value,
        licenseNumber: '',
      }));
      setErrors((previous) => {
        const next = { ...previous };
        delete next.licenseNumber;
        delete next.appFeeNumber;
        return next;
      });
    },
    [identifierType]
  );

  const setSelectedIdentifierType = useCallback((nextType: SignupIdentifierType) => {
    setIdentifierType(nextType);
    setForm((previous) => ({
      ...previous,
      licenseNumber: nextType === 'license' ? previous.licenseNumber : '',
      appFeeNumber: nextType === 'appFee' ? previous.appFeeNumber : '',
    }));
  }, []);

  const validateIdentifierField = useCallback(() => {
    const normalizedForm = normalizeCslbMomentumSyncForm(form);
    const validationErrors = validateCslbMomentumSyncForm(normalizedForm);

    setErrors((previous) => {
      const next = { ...previous };
      const nextIdentifierError =
        identifierType === 'license'
          ? validationErrors.licenseNumber
          : validationErrors.appFeeNumber;

      if (nextIdentifierError) {
        next.licenseNumber = nextIdentifierError;
        next.appFeeNumber = nextIdentifierError;
      } else {
        delete next.licenseNumber;
        delete next.appFeeNumber;
      }
      return next;
    });
  }, [form, identifierType]);

  const validateField = useCallback(
    (field: CslbMomentumSyncFormField) => {
      const normalizedForm = normalizeCslbMomentumSyncForm(form);
      const validationErrors = validateCslbMomentumSyncForm(normalizedForm);

      setErrors((previous) => {
        const next = { ...previous };
        const fieldsToSync =
          field === 'licenseNumber' || field === 'appFeeNumber'
            ? (['licenseNumber', 'appFeeNumber'] as CslbMomentumSyncFormField[])
            : ([field] as CslbMomentumSyncFormField[]);

        for (const entry of fieldsToSync) {
          const nextMessage = validationErrors[entry];
          if (nextMessage) {
            next[entry] = nextMessage;
          } else {
            delete next[entry];
          }
        }

        return next;
      });
    },
    [form]
  );

  const submit = useCallback(async (): Promise<CslbMomentumSyncSubmitResult | null> => {
    if (isSubmitting) return null;

    const normalizedForm = normalizeCslbMomentumSyncForm(form);
    const resolvedAgentName =
      normalizedForm.agentName || savedAgentName || getNextRoundRobinAgentName(null);
    const normalizedFormWithAgent = {
      ...normalizedForm,
      agentName: resolvedAgentName,
    };
    const validationErrors = validateCslbMomentumSyncForm(normalizedFormWithAgent);

    setForm(normalizedFormWithAgent);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setResponse(null);
      return null;
    }

    const request = buildCslbMomentumSyncRequest(normalizedFormWithAgent);

    setIsSubmitting(true);
    setErrorMessage('');
    setResponse(null);
    setLastRequest(request);

    try {
      const nextResponse = await syncCslbMomentum(request);

      await upsertSignupAccount({
        firstName: normalizedFormWithAgent.firstName,
        lastName: normalizedFormWithAgent.lastName,
        email: normalizedFormWithAgent.email,
        licenseNumber: normalizedFormWithAgent.licenseNumber,
        appFeeNumber: normalizedFormWithAgent.appFeeNumber,
        agentName: normalizedFormWithAgent.agentName,
        syncResponse: nextResponse,
      });

      try {
        await AsyncStorage.setItem(AGENT_NAME_STORAGE_KEY, resolvedAgentName);
      } catch {
        // Agent persistence is non-blocking.
      }

      try {
        await recordAssignedAgentName(resolvedAgentName);
      } catch {
        // Supabase assignment tracking is non-blocking for signup completion.
      }

      setSavedAgentName(getNextRoundRobinAgentName(resolvedAgentName));

      try {
        await sendEmailSignInCode(normalizedFormWithAgent.email);
      } catch (caughtError) {
        if (isOtpRateLimitError(caughtError)) {
          setResponse(nextResponse);
          return {
            email: normalizedFormWithAgent.email,
            rateLimited: true,
          };
        }
        throw caughtError;
      }
      setResponse(nextResponse);
      return {
        email: normalizedFormWithAgent.email,
        rateLimited: false,
      };
    } catch (caughtError) {
      setResponse(null);
      if (caughtError instanceof Error && caughtError.message) {
        setErrorMessage(caughtError.message);
      } else {
        setErrorMessage('Unable to complete sync. Please try again.');
      }
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isSubmitting, savedAgentName]);

  const reset = useCallback(() => {
    setForm({
      ...CSLB_MOMENTUM_SYNC_DEFAULT_FORM,
      agentName: savedAgentName,
    });
    setErrors({});
    setErrorMessage('');
    setResponse(null);
    setLastRequest(null);
    setIsSubmitting(false);
  }, [savedAgentName]);

  const uiState = useMemo<CslbMomentumSyncUiState>(() => {
    if (isSubmitting) return 'loading';
    if (errorMessage) return 'error';
    if (response) return 'success';
    return 'idle';
  }, [errorMessage, isSubmitting, response]);

  return {
    form,
    identifierType,
    errors,
    uiState,
    isSubmitting,
    errorMessage,
    response,
    lastRequest,
    updateField,
    setIdentifierValue,
    setSelectedIdentifierType,
    validateIdentifierField,
    validateField,
    submit,
    reset,
  };
}
