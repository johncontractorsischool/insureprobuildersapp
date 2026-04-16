import { isOtpRateLimitError, persistCustomersForEmail, sendEmailSignInCode } from '@/services/auth-flow';
import { getSupabaseClient } from '@/services/supabase';
import { buildCustomerLookupRecord } from '@/tests/factories';

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.Mock;

function createSupabaseAuthMock() {
  return {
    auth: {
      signInWithOtp: jest.fn(),
    },
  };
}

function createSupabaseWriteMock() {
  const tableMock = {
    upsert: jest.fn(),
  };

  return {
    from: jest.fn(() => tableMock),
    __table: tableMock,
  };
}

describe('sendEmailSignInCode', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('requests an OTP with user creation enabled by default', async () => {
    const supabaseMock = createSupabaseAuthMock();
    supabaseMock.auth.signInWithOtp.mockResolvedValue({ error: null });
    mockedGetSupabaseClient.mockReturnValue(supabaseMock);

    await sendEmailSignInCode('jane@example.com');

    expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'jane@example.com',
      options: {
        shouldCreateUser: true,
      },
    });
  });

  it('retries without user creation when Supabase blocks signups', async () => {
    const supabaseMock = createSupabaseAuthMock();
    supabaseMock.auth.signInWithOtp
      .mockResolvedValueOnce({
        error: {
          code: 'signup_disabled',
          message: 'Signups not allowed for otp',
        },
      })
      .mockResolvedValueOnce({ error: null });
    mockedGetSupabaseClient.mockReturnValue(supabaseMock);

    await sendEmailSignInCode('jane@example.com');

    expect(supabaseMock.auth.signInWithOtp).toHaveBeenNthCalledWith(1, {
      email: 'jane@example.com',
      options: {
        shouldCreateUser: true,
      },
    });
    expect(supabaseMock.auth.signInWithOtp).toHaveBeenNthCalledWith(2, {
      email: 'jane@example.com',
      options: {
        shouldCreateUser: false,
      },
    });
  });

  it('throws a targeted message when signups are disabled and no auth user exists yet', async () => {
    const supabaseMock = createSupabaseAuthMock();
    supabaseMock.auth.signInWithOtp
      .mockResolvedValueOnce({
        error: {
          code: 'signup_disabled',
          message: 'Signups not allowed for otp',
        },
      })
      .mockResolvedValueOnce({
        error: {
          code: 'user_not_found',
          message: 'User not found',
        },
      });
    mockedGetSupabaseClient.mockReturnValue(supabaseMock);

    await expect(sendEmailSignInCode('jane@example.com')).rejects.toThrow(
      'This email does not have a Supabase sign-in yet, and creating new email users is disabled. Enable email signups in Supabase Auth or create the user first.'
    );
  });

  it('throws a targeted message when email OTP is disabled in Supabase', async () => {
    const supabaseMock = createSupabaseAuthMock();
    supabaseMock.auth.signInWithOtp.mockResolvedValue({
      error: {
        code: 'email_provider_disabled',
        message: 'Email logins are disabled',
      },
    });
    mockedGetSupabaseClient.mockReturnValue(supabaseMock);

    await expect(sendEmailSignInCode('jane@example.com')).rejects.toThrow(
      'Supabase email verification is disabled. Enable the Email provider and OTP sign-in in Supabase Auth settings.'
    );
  });

  it('throws a targeted message when Supabase cannot deliver the verification email', async () => {
    const supabaseMock = createSupabaseAuthMock();
    supabaseMock.auth.signInWithOtp.mockResolvedValue({
      error: {
        code: 'unexpected_failure',
        message: 'Error sending confirmation email',
      },
    });
    mockedGetSupabaseClient.mockReturnValue(supabaseMock);

    await expect(sendEmailSignInCode('jane@example.com')).rejects.toThrow(
      'Supabase could not send the verification email. Check Auth > Email settings, your SMTP/provider configuration, and the sender address for this project.'
    );
  });

  it('treats Supabase rate-limit codes as OTP throttling', () => {
    expect(
      isOtpRateLimitError({
        code: 'over_email_send_rate_limit',
        message: 'Email rate limit exceeded',
      })
    ).toBe(true);
  });
});

describe('persistCustomersForEmail', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('upserts cached customers by login email and database id', async () => {
    const supabaseMock = createSupabaseWriteMock();
    const upsert = supabaseMock.__table.upsert as jest.Mock;
    upsert.mockResolvedValue({ error: null });
    mockedGetSupabaseClient.mockReturnValue(supabaseMock);

    await persistCustomersForEmail('jane@example.com', [buildCustomerLookupRecord()]);

    expect(supabaseMock.from).toHaveBeenCalledWith('portal_customers');
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          login_email: 'jane@example.com',
          database_id: 'insured-db-1',
        }),
      ],
      {
        onConflict: 'login_email,database_id',
      }
    );
  });

  it('throws a readable error when Supabase rejects the cache upsert', async () => {
    const supabaseMock = createSupabaseWriteMock();
    const upsert = supabaseMock.__table.upsert as jest.Mock;
    upsert.mockResolvedValue({
      error: {
        message: 'new row violates row-level security policy',
      },
    });
    mockedGetSupabaseClient.mockReturnValue(supabaseMock);

    await expect(
      persistCustomersForEmail('jane@example.com', [buildCustomerLookupRecord()])
    ).rejects.toThrow(
      'Unable to save customer profile to Supabase (new row violates row-level security policy).'
    );
  });
});
