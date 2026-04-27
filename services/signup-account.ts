import { CslbMomentumSyncSuccessResponse } from '@/services/cslb-momentum-sync-api';
import { getSupabaseClient } from '@/services/supabase';

const DEFAULT_SIGNUP_TABLE = 'portal_signups';
const SIGNUP_ACCOUNT_LOG_PREFIX = '[Signup Account]';

export type SignupAccountPayload = {
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
  appFeeNumber: string;
  agentName: string;
  syncResponse: CslbMomentumSyncSuccessResponse;
};

function normalizeText(value: string) {
  return value.trim();
}

function getSignupTableName() {
  return process.env.EXPO_PUBLIC_SUPABASE_SIGNUP_TABLE?.trim() || DEFAULT_SIGNUP_TABLE;
}

function maskEmail(value: string) {
  const [name, domain] = value.split('@');
  if (!name || !domain) return value;
  const first = name.charAt(0);
  const last = name.charAt(name.length - 1);
  const middle = '*'.repeat(Math.max(2, name.length - 2));
  return `${first}${middle}${last}@${domain}`;
}

function logSignupAccount(event: string, details: Record<string, unknown>) {
  console.log(`${SIGNUP_ACCOUNT_LOG_PREFIX} ${event}`, details);
}

function logSignupAccountWarning(event: string, details: Record<string, unknown>) {
  console.warn(`${SIGNUP_ACCOUNT_LOG_PREFIX} ${event}`, details);
}

export async function upsertSignupAccount(payload: SignupAccountPayload) {
  const supabase = getSupabaseClient();
  const table = getSignupTableName();
  const loginEmail = normalizeText(payload.email).toLowerCase();
  const row = {
    login_email: loginEmail,
    first_name: normalizeText(payload.firstName),
    last_name: normalizeText(payload.lastName),
    license_number: normalizeText(payload.licenseNumber),
    app_fee_number: normalizeText(payload.appFeeNumber),
    agent_name: normalizeText(payload.agentName),
    sync_status: payload.syncResponse.result.status,
    sync_message: payload.syncResponse.result.message,
    cslb_payload: payload.syncResponse.result.cslb ?? {},
    momentum_payload: payload.syncResponse.result.momentum ?? {},
    updated_at: new Date().toISOString(),
  };
  const emailMasked = maskEmail(loginEmail);

  logSignupAccount('insert_started', {
    table,
    emailMasked,
    syncStatus: row.sync_status,
  });

  const { error: insertError } = await supabase.from(table).insert(row);

  if (!insertError) {
    logSignupAccount('insert_succeeded', {
      table,
      emailMasked,
      syncStatus: row.sync_status,
    });
    return;
  }

  const isDuplicateEmail = insertError.code === '23505';
  if (!isDuplicateEmail) {
    logSignupAccountWarning('insert_failed', {
      table,
      emailMasked,
      errorCode: insertError.code ?? null,
      errorMessage: insertError.message,
    });
    throw new Error(`Unable to save signup profile (${insertError.message}).`);
  }

  logSignupAccount('insert_duplicate_email', {
    table,
    emailMasked,
  });

  const { error: updateError } = await supabase
    .from(table)
    .update({
      first_name: row.first_name,
      last_name: row.last_name,
      license_number: row.license_number,
      app_fee_number: row.app_fee_number,
      agent_name: row.agent_name,
      sync_status: row.sync_status,
      sync_message: row.sync_message,
      cslb_payload: row.cslb_payload,
      momentum_payload: row.momentum_payload,
      updated_at: row.updated_at,
    })
    .eq('login_email', row.login_email);

  if (updateError) {
    logSignupAccountWarning('update_failed', {
      table,
      emailMasked,
      errorCode: updateError.code ?? null,
      errorMessage: updateError.message,
    });
    throw new Error(`Unable to save signup profile (${updateError.message}).`);
  }

  logSignupAccount('update_succeeded', {
    table,
    emailMasked,
    syncStatus: row.sync_status,
  });
}
