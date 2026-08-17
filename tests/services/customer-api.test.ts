import {
  fetchAccountByBusinessEmail,
  fetchCustomersByEmail,
  resolveMyAccount,
  resolveMyAccountByLicense,
} from '@/services/customer-api';

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: 'supabase-token',
            user: { email: 'jane@example.com' },
          },
        },
      }),
    },
  }),
}));

describe('PBIA customer api', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_PBIA_API_BASE_URL;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://localhost:3500';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = originalBaseUrl;
  });

  it('loads email-scoped PBIA accounts and maps compatibility fields', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'account-1',
            legalName: 'Builder Co',
            dba: null,
            email: 'jane@example.com',
            phone: '5551112222',
            licenseNumber: '1144038',
            status: 'ACTIVE',
            entityType: 'LLC',
            agentId: 'agent-1',
            agent: null,
            policyCount: 2,
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const accounts = await fetchCustomersByEmail('jane@example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3500/client/account?page=1&pageSize=50',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer supabase-token' }),
      })
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Client-Email');
    expect(accounts[0]).toEqual(
      expect.objectContaining({
        accountId: 'account-1',
        databaseId: 'account-1',
        licenseNumber: '1144038',
        insuredId: '1144038',
      })
    );
  });

  it('resolves a single MyAccount without downloading an account list', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ACCOUNT_RESOLVED',
        matchCount: 1,
        account: {
          id: 'account-1',
          legalName: 'Builder Co',
          dba: null,
          email: 'jane@example.com',
          phone: '5551112222',
          licenseNumber: '1144038',
          status: 'ACTIVE',
          entityType: 'LLC',
          agentId: 'agent-1',
          agent: null,
          policyCount: 2,
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveMyAccount(' Jane@Example.com ');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3500/client/my-account/resolve',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer supabase-token' }),
      })
    );
    expect(resolution).toEqual({
      status: 'ACCOUNT_RESOLVED',
      matchCount: 1,
      account: expect.objectContaining({
        accountId: 'account-1',
        databaseId: 'account-1',
        insuredId: '1144038',
      }),
    });
  });

  it.each([
    [{ status: 'SIGNUP_ALLOWED', matchCount: 0 }, { status: 'SIGNUP_ALLOWED', matchCount: 0 }],
    [{ status: 'LICENSE_REQUIRED', matchCount: 3 }, { status: 'LICENSE_REQUIRED', matchCount: 3 }],
  ])('preserves the non-account MyAccount resolution state', async (payload, expected) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    }) as unknown as typeof fetch;

    await expect(resolveMyAccount('jane@example.com')).resolves.toEqual(expected);
  });

  it('submits the license to the server and maps only the resolved account', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ACCOUNT_RESOLVED',
        matchCount: 3,
        account: {
          id: 'account-2',
          legalName: 'Selected Builder Co',
          dba: null,
          email: 'jane@example.com',
          phone: null,
          licenseNumber: '1144038',
          status: 'ACTIVE',
          entityType: 'LLC',
          agentId: null,
          agent: null,
          policyCount: 1,
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveMyAccountByLicense(
      'jane@example.com',
      '  1144038  '
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3500/client/my-account/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ licenseNumber: '1144038' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer supabase-token',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(resolution).toEqual(
      expect.objectContaining({
        status: 'ACCOUNT_RESOLVED',
        matchCount: 3,
        account: expect.objectContaining({ accountId: 'account-2', insuredId: '1144038' }),
      })
    );
  });

  it('rejects malformed resolver payloads instead of making an auth decision', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'LICENSE_REQUIRED', matchCount: 1 }),
    }) as unknown as typeof fetch;

    await expect(resolveMyAccount('jane@example.com')).rejects.toThrow(
      'Unexpected PBIA account resolution response format.'
    );
  });

  it('uses the singular primary business-email endpoint for sign-in discovery', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'account-1',
        legalName: 'Builder Co',
        dba: null,
        email: 'jane@example.com',
        phone: '5551112222',
        licenseNumber: '1144038',
        status: 'ACTIVE',
        entityType: 'LLC',
        agentId: 'agent-1',
        agent: null,
        policyCount: 2,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const account = await fetchAccountByBusinessEmail(' Jane@Example.com ');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3500/client/account/by-business-email',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer supabase-token',
        }),
      })
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Client-Email');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('x-api-key');
    expect(account).toEqual(
      expect.objectContaining({ accountId: 'account-1', insuredId: '1144038' })
    );
  });

  it('maps a missing primary business-email account to null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Client account not found' }),
    }) as unknown as typeof fetch;

    await expect(fetchAccountByBusinessEmail('jane@example.com')).resolves.toBeNull();
  });

  it('preserves an ambiguous primary business-email conflict', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Multiple client accounts use this business email' }),
    }) as unknown as typeof fetch;

    await expect(fetchAccountByBusinessEmail('jane@example.com')).rejects.toThrow(
      'Multiple client accounts use this business email'
    );
  });
});
