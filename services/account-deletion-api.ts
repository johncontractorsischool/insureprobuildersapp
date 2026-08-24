import { getSupabaseClient } from '@/services/supabase';

const DELETE_ACCOUNT_FUNCTION = 'delete-account';

export async function deleteCurrentSupabaseAccount() {
  const { error } = await getSupabaseClient().functions.invoke(DELETE_ACCOUNT_FUNCTION, {
    body: {},
  });

  if (error) {
    const message = error.message?.trim() ?? '';
    if (/failed to send a request|failed to fetch|fetch failed|network request failed/i.test(message)) {
      throw new Error('Unable to reach the account deletion service. Your account was not deleted.');
    }
    throw new Error(
      message || 'Unable to delete your account right now. Please try again.'
    );
  }
}
