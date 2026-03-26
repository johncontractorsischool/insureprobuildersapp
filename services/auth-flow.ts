import { Customer, CustomerLookupRecord } from '@/types/customer';

import { getSupabaseClient } from '@/services/supabase';

const CUSTOMER_TABLE = process.env.EXPO_PUBLIC_SUPABASE_CUSTOMER_TABLE?.trim() || 'portal_customers';
const OTP_RATE_LIMIT_HINTS = ['rate limit', 'too many requests', 'security purposes'];

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

export function isOtpRateLimitError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.toLowerCase();
  return OTP_RATE_LIMIT_HINTS.some((hint) => normalizedMessage.includes(hint));
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
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    if (isOtpRateLimitError(error)) {
      throw new Error(
        'Too many verification code requests. Use your most recent code or wait before requesting another email.'
      );
    }
    throw new Error(`Unable to send verification code (${error.message}).`);
  }
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
