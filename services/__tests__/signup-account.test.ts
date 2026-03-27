import { upsertSignupAccount } from '@/services/signup-account';
import { getSupabaseClient } from '@/services/supabase';

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.Mock;

describe('upsertSignupAccount', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('inserts signup profile data to Supabase', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ insert });
    mockedGetSupabaseClient.mockReturnValue({ from });

    await upsertSignupAccount({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      licenseNumber: '1105382',
      appFeeNumber: '',
      agentName: 'Aries Apcar',
      syncResponse: {
        ok: true,
        result: {
          status: 'created',
          message: 'Created',
          cslb: { licenseNumber: '1105382' },
          momentum: { id: 'mom-1' },
        },
      },
    });

    expect(from).toHaveBeenCalledWith('portal_signups');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        login_email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        sync_status: 'created'
      })
    );
  });

  it('falls back to update when email already exists', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest
      .fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({ update });
    mockedGetSupabaseClient.mockReturnValue({ from });

    await upsertSignupAccount({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      licenseNumber: '1105382',
      appFeeNumber: '',
      agentName: 'Aries Apcar',
      syncResponse: {
        ok: true,
        result: {
          status: 'existing',
          message: 'Already existed',
          cslb: {},
          momentum: {},
        },
      },
    });

    expect(insert).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'John',
        last_name: 'Doe',
      })
    );
    expect(eq).toHaveBeenCalledWith('login_email', 'john@example.com');
  });

  it('throws when insert fails for non-duplicate reason', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    const from = jest.fn().mockReturnValue({ insert });
    mockedGetSupabaseClient.mockReturnValue({ from });

    await expect(
      upsertSignupAccount({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        licenseNumber: '1105382',
        appFeeNumber: '',
        agentName: 'Aries Apcar',
        syncResponse: {
          ok: true,
          result: {
            status: 'existing',
            message: 'Already existed',
            cslb: {},
            momentum: {},
          },
        },
      })
    ).rejects.toThrow('Unable to save signup profile (permission denied).');
  });
});
