import { useCallback, useMemo, useState } from 'react';

import { isOtpRateLimitError, sendEmailSignInCode } from '@/services/auth-flow';
import { ClientSignupRequest, createClientSignup } from '@/services/client-signup-api';

export type SignupIdentifierType = 'license' | 'appFee';

export type ClientSignupForm = {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  licenseNumber: string;
  appFeeNumber: string;
};

export type ClientSignupFormField = keyof ClientSignupForm;
export type ClientSignupValidationErrors = Partial<Record<ClientSignupFormField, string>>;
export type ClientSignupSubmitResult = {
  email: string;
  rateLimited: boolean;
  otpDeliveryFailed: boolean;
};

export const CLIENT_SIGNUP_DEFAULT_FORM: ClientSignupForm = {
  businessName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipCode: '',
  licenseNumber: '',
  appFeeNumber: '',
};

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeClientSignupForm(form: ClientSignupForm): ClientSignupForm {
  return {
    ...form,
    businessName: form.businessName.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    zipCode: form.zipCode.trim(),
    licenseNumber: form.licenseNumber.trim(),
    appFeeNumber: form.appFeeNumber.trim(),
  };
}

export function validateClientSignupForm(form: ClientSignupForm): ClientSignupValidationErrors {
  const errors: ClientSignupValidationErrors = {};
  if (!form.businessName) errors.businessName = 'Business name is required.';
  if (!form.firstName) errors.firstName = 'First name is required.';
  if (!form.lastName) errors.lastName = 'Last name is required.';
  if (!form.email) errors.email = 'Email is required.';
  else if (!isEmailValid(form.email)) errors.email = 'Enter a valid email address.';
  if (form.phone && form.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Phone must contain at least 7 digits.';
  }
  if (!form.addressLine1) errors.addressLine1 = 'Street address is required.';
  if (!form.city) errors.city = 'City is required.';
  if (form.state.length !== 2) errors.state = 'Enter a 2-letter state code.';
  if (form.zipCode.length < 5) errors.zipCode = 'Enter a valid ZIP code.';
  if (!form.licenseNumber && !form.appFeeNumber) {
    const message = 'Enter a license number or app fee number.';
    errors.licenseNumber = message;
    errors.appFeeNumber = message;
  }
  return errors;
}

export function buildClientSignupRequest(form: ClientSignupForm): ClientSignupRequest {
  return {
    legalName: form.businessName,
    email: form.email,
    ...(form.phone ? { phone: form.phone } : {}),
    status: 'PROSPECT',
    licenseNumber: form.appFeeNumber || form.licenseNumber,
    primaryContactFirstName: form.firstName,
    primaryContactLastName: form.lastName,
    addressLine1: form.addressLine1,
    ...(form.addressLine2 ? { addressLine2: form.addressLine2 } : {}),
    city: form.city,
    state: form.state,
    zipCode: form.zipCode,
  };
}

export function useClientSignup() {
  const [identifierType, setIdentifierType] = useState<SignupIdentifierType>('license');
  const [form, setForm] = useState<ClientSignupForm>(CLIENT_SIGNUP_DEFAULT_FORM);
  const [errors, setErrors] = useState<ClientSignupValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [didSubmit, setDidSubmit] = useState(false);

  const updateField = useCallback((field: ClientSignupFormField, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrorMessage('');
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }, []);

  const setIdentifierValue = useCallback(
    (value: string) => {
      setForm((previous) => ({
        ...previous,
        licenseNumber: identifierType === 'license' ? value : '',
        appFeeNumber: identifierType === 'appFee' ? value : '',
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

  const setSelectedIdentifierType = useCallback((type: SignupIdentifierType) => {
    setIdentifierType(type);
    setForm((previous) => ({
      ...previous,
      licenseNumber: type === 'license' ? previous.licenseNumber : '',
      appFeeNumber: type === 'appFee' ? previous.appFeeNumber : '',
    }));
  }, []);

  const validateField = useCallback(
    (field: ClientSignupFormField) => {
      const normalized = normalizeClientSignupForm(form);
      const nextErrors = validateClientSignupForm(normalized);
      setErrors((previous) => ({ ...previous, [field]: nextErrors[field] }));
    },
    [form]
  );

  const validateIdentifierField = useCallback(() => {
    const nextErrors = validateClientSignupForm(normalizeClientSignupForm(form));
    setErrors((previous) => ({
      ...previous,
      licenseNumber: nextErrors.licenseNumber,
      appFeeNumber: nextErrors.appFeeNumber,
    }));
  }, [form]);

  const submit = useCallback(async (): Promise<ClientSignupSubmitResult | null> => {
    if (isSubmitting) return null;
    const normalized = normalizeClientSignupForm(form);
    const nextErrors = validateClientSignupForm(normalized);
    setForm(normalized);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    setIsSubmitting(true);
    setErrorMessage('');
    setDidSubmit(false);
    try {
      await createClientSignup(buildClientSignupRequest(normalized));
      try {
        await sendEmailSignInCode(normalized.email);
      } catch (error) {
        if (isOtpRateLimitError(error)) {
          setDidSubmit(true);
          return { email: normalized.email, rateLimited: true, otpDeliveryFailed: false };
        }
        setDidSubmit(true);
        return { email: normalized.email, rateLimited: false, otpDeliveryFailed: true };
      }
      setDidSubmit(true);
      return { email: normalized.email, rateLimited: false, otpDeliveryFailed: false };
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message ? error.message : 'Unable to create your PBIA account.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isSubmitting]);

  const reset = useCallback(() => {
    setForm(CLIENT_SIGNUP_DEFAULT_FORM);
    setErrors({});
    setErrorMessage('');
    setDidSubmit(false);
  }, []);

  const uiState = useMemo(() => {
    if (isSubmitting) return 'loading' as const;
    if (errorMessage) return 'error' as const;
    if (didSubmit) return 'success' as const;
    return 'idle' as const;
  }, [didSubmit, errorMessage, isSubmitting]);

  return {
    form,
    identifierType,
    errors,
    uiState,
    isSubmitting,
    errorMessage,
    updateField,
    setIdentifierValue,
    setSelectedIdentifierType,
    validateIdentifierField,
    validateField,
    submit,
    reset,
  };
}
