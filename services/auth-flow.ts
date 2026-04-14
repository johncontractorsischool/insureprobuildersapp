import { Customer, CustomerLookupRecord } from '@/types/customer';

import { getSupabaseClient } from '@/services/supabase';

const CUSTOMER_TABLE = process.env.EXPO_PUBLIC_SUPABASE_CUSTOMER_TABLE?.trim() || 'portal_customers';
const OTP_RATE_LIMIT_HINTS = ['rate limit', 'too many requests', 'security purposes'];
const OTP_RATE_LIMIT_CODES = ['over_request_rate_limit', 'over_email_send_rate_limit'];
const SIGNUP_DISABLED_CODES = ['signup_disabled'];
const EMAIL_PROVIDER_DISABLED_CODES = ['email_provider_disabled', 'otp_disabled'];
const CAPTCHA_REQUIRED_CODES = ['captcha_failed'];
const EMAIL_NOT_AUTHORIZED_CODES = ['email_address_not_authorized'];
const INVALID_EMAIL_CODES = ['email_address_invalid'];
const USER_NOT_FOUND_CODES = ['user_not_found'];
const EMAIL_DELIVERY_FAILURE_HINTS = ['error sending confirmation email', 'error sending magic link'];

type AuthErrorLike = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

function mapCustomerRecord(loginEmail: string, customer: CustomerLookupRecord) {
  return {
    database_id: customer.databaseId,
    login_email: loginEmail,
    customer_id: customer.customerId,
    insured_id: customer.insuredId,
    commercial_name: customer.commercialName,
    first_name: customer.firstName,
    last_name: customer.lastName,
    email: customer.eMail,
    phone: customer.phone,
    cell_phone: customer.cellPhone,
    is_active: customer.active,
    source_payload: customer,
    updated_at: new Date().toISOString(),
  };
}

function buildFullName(customer: CustomerLookupRecord) {
  const first = customer.firstName?.trim();
  const last = customer.lastName?.trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  return customer.commercialName?.trim() || null;
}

export function toCustomerProfile(customer: CustomerLookupRecord): Customer {
  return {
    databaseId: customer.databaseId,
    commercialName: customer.commercialName,
    fullName: buildFullName(customer),
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.eMail,
    phone: customer.phone,
    cellPhone: customer.cellPhone,
    customerId: customer.customerId,
    insuredId: customer.insuredId,
    active: customer.active,
  };
}

export function toUserFacingError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function getAuthErrorDetails(error: unknown): AuthErrorLike {
  if (!error || typeof error !== 'object') return {};

  const details = error as AuthErrorLike;
  return {
    code: typeof details.code === 'string' ? details.code.toLowerCase() : undefined,
    message:
      typeof details.message === 'string'
        ? details.message
        : error instanceof Error && error.message
          ? error.message
          : undefined,
    name: typeof details.name === 'string' ? details.name : error instanceof Error ? error.name : undefined,
    status: typeof details.status === 'number' ? details.status : undefined,
  };
}

function errorCodeMatches(error: unknown, codes: string[]) {
  const { code } = getAuthErrorDetails(error);
  return Boolean(code && codes.includes(code));
}

function errorMessageIncludes(error: unknown, hints: string[]) {
  const { message } = getAuthErrorDetails(error);
  if (!message) return false;

  const normalizedMessage = message.toLowerCase();
  return hints.some((hint) => normalizedMessage.includes(hint));
}

export function isOtpRateLimitError(error: unknown) {
  return errorCodeMatches(error, OTP_RATE_LIMIT_CODES) || errorMessageIncludes(error, OTP_RATE_LIMIT_HINTS);
}

function isSignupDisabledError(error: unknown) {
  return errorCodeMatches(error, SIGNUP_DISABLED_CODES) || errorMessageIncludes(error, ['signups not allowed']);
}

function isEmailProviderDisabledError(error: unknown) {
  return (
    errorCodeMatches(error, EMAIL_PROVIDER_DISABLED_CODES) ||
    errorMessageIncludes(error, ['email logins are disabled', 'otp is disabled', 'provider is disabled'])
  );
}

function isCaptchaRequiredError(error: unknown) {
  return errorCodeMatches(error, CAPTCHA_REQUIRED_CODES) || errorMessageIncludes(error, ['captcha']);
}

function isEmailAddressNotAuthorizedError(error: unknown) {
  return (
    errorCodeMatches(error, EMAIL_NOT_AUTHORIZED_CODES) ||
    errorMessageIncludes(error, ['not authorized', 'recipient address rejected'])
  );
}

function isInvalidEmailAddressError(error: unknown) {
  return errorCodeMatches(error, INVALID_EMAIL_CODES) || errorMessageIncludes(error, ['invalid email']);
}

function isUserNotFoundError(error: unknown) {
  return errorCodeMatches(error, USER_NOT_FOUND_CODES) || errorMessageIncludes(error, ['user not found']);
}

function isEmailDeliveryFailureError(error: unknown) {
  return errorMessageIncludes(error, EMAIL_DELIVERY_FAILURE_HINTS);
}

function isNetworkAuthError(error: unknown) {
  const { message, name, status } = getAuthErrorDetails(error);
  const normalizedMessage = message?.toLowerCase() ?? '';
  return (
    status === 0 ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network request failed') ||
    name === 'AuthRetryableFetchError'
  );
}

function toOtpSendFailureMessage(error: unknown) {
  if (isOtpRateLimitError(error)) {
    return 'Too many verification code requests. Use your most recent code or wait before requesting another email.';
  }

  if (isInvalidEmailAddressError(error)) {
    return 'Enter a valid email address to continue.';
  }

  if (isEmailProviderDisabledError(error)) {
    return 'Supabase email verification is disabled. Enable the Email provider and OTP sign-in in Supabase Auth settings.';
  }

  if (isCaptchaRequiredError(error)) {
    return 'Supabase rejected the verification request because CAPTCHA protection is enabled. Add a CAPTCHA token to this auth flow or disable CAPTCHA for email OTP.';
  }

  if (isEmailAddressNotAuthorizedError(error)) {
    return 'Supabase rejected this email address. Check your Auth allowlist or SMTP recipient restrictions.';
  }

  if (isEmailDeliveryFailureError(error)) {
    return 'Supabase could not send the verification email. Check Auth > Email settings, your SMTP/provider configuration, and the sender address for this project.';
  }

  if (isNetworkAuthError(error)) {
    return 'Unable to reach Supabase Auth. Check network access and the EXPO_PUBLIC_SUPABASE_URL setting.';
  }

  if (isSignupDisabledError(error)) {
    return 'Supabase blocked this sign-in because creating new email users is disabled. Enable email signups in Supabase Auth or create the user first.';
  }

  const { message } = getAuthErrorDetails(error);
  return message ? `Unable to send verification code (${message}).` : 'Unable to send verification code.';
}

async function requestEmailSignInCode(email: string, shouldCreateUser: boolean) {
  const supabase = getSupabaseClient();
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
    },
  });
}

export async function persistCustomersForEmail(loginEmail: string, customers: CustomerLookupRecord[]) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from(CUSTOMER_TABLE)
    .upsert(customers.map((customer) => mapCustomerRecord(loginEmail, customer)), {
      onConflict: 'database_id',
    });

  if (error) {
    throw new Error(`Unable to save customer profile to Supabase (${error.message}).`);
  }
}

export async function sendEmailSignInCode(email: string) {
  const initialAttempt = await requestEmailSignInCode(email, true);
  if (!initialAttempt.error) return;

  if (isSignupDisabledError(initialAttempt.error)) {
    const existingUserAttempt = await requestEmailSignInCode(email, false);
    if (!existingUserAttempt.error) return;

    if (isUserNotFoundError(existingUserAttempt.error)) {
      throw new Error(
        'This email does not have a Supabase sign-in yet, and creating new email users is disabled. Enable email signups in Supabase Auth or create the user first.'
      );
    }

    throw new Error(toOtpSendFailureMessage(existingUserAttempt.error));
  }

  throw new Error(toOtpSendFailureMessage(initialAttempt.error));
}

export async function verifyEmailSignInCode(email: string, code: string) {
  const supabase = getSupabaseClient();
  const normalizedCode = code.replace(/\D/g, '');

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: normalizedCode,
    type: 'email',
  });

  if (error) {
    throw new Error('Invalid or expired verification code. Request a new code and try again.');
  }

  return data.user?.email ?? email;
}

export async function signOutSupabaseSession() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}
