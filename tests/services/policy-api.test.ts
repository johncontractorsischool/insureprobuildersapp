import { fetchPoliciesByAccount } from '@/services/policy-api';

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
        error: null,
      }),
    },
  }),
}));

describe('PBIA policy api', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://localhost:3000';
  });

  it('maps policies returned for the selected account', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'policy-1',
            accountId: 'account-1',
            accountName: 'Builder Co',
            policyNumber: 'GL-1001',
            recordType: 'POLICY',
            status: 'ACTIVE',
            lineOfBusiness: 'General Liability',
            effectiveDate: '2026-01-01T00:00:00.000Z',
            expirationDate: '2027-01-01T00:00:00.000Z',
            carrierReference: 'Carrier One',
            premium: 1000,
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const policies = await fetchPoliciesByAccount('jane@example.com', 'account-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/policies?accountId=account-1&page=1&pageSize=50',
      expect.objectContaining({ method: 'GET' })
    );
    expect(policies[0]).toEqual(
      expect.objectContaining({ id: 'policy-1', status: 'Active', policyNumber: 'GL-1001' })
    );
  });
});
