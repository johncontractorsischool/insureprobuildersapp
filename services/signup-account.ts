import { CslbMomentumSyncSuccessResponse } from '@/services/cslb-momentum-sync-api';
import { getSupabaseClient } from '@/services/supabase';

const DEFAULT_SIGNUP_TABLE = 'portal_signups';

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

export async function upsertSignupAccount(payload: SignupAccountPayload) {
  const supabase = getSupabaseClient();
  const table = getSignupTableName();
  const row = {
    login_email: normalizeText(payload.email).toLowerCase(),
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

  const { error: insertError } = await supabase.from(table).insert(row);

  if (!insertError) return;

  const isDuplicateEmail = insertError.code === '23505';
  if (!isDuplicateEmail) {
    throw new Error(`Unable to save signup profile (${insertError.message}).`);
  }

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
    throw new Error(`Unable to save signup profile (${updateError.message}).`);
  }
}
