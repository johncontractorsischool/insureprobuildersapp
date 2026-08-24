const mockInvoke = jest.fn();

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => ({
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  }),
}));

import { deleteCurrentSupabaseAccount } from '@/services/account-deletion-api';

describe('account deletion API', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('invokes the authenticated account deletion function', async () => {
    mockInvoke.mockResolvedValue({ data: { deleted: true }, error: null });

    await deleteCurrentSupabaseAccount();

    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { body: {} });
  });

  it('surfaces account deletion function failures', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Account deletion service is unavailable.'),
    });

    await expect(deleteCurrentSupabaseAccount()).rejects.toThrow(
      'Account deletion service is unavailable.'
    );
  });

  it('maps edge-function transport failures to a safe deletion message', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Failed to send a request to the Edge Function'),
    });

    await expect(deleteCurrentSupabaseAccount()).rejects.toThrow(
      'Unable to reach the account deletion service. Your account was not deleted.'
    );
  });
});
