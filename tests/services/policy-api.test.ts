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

  it('follows all pages, retains LLC identity and excludes quotes and non-active records', async () => {
    const base = { id: 'llc', accountId: 'account-1', accountName: 'John Test Company', policyNumber: '24312323',
      recordType: 'POLICY', status: ' active ', lineOfBusiness: 'LLC Bond', carrierReference: 'ALLEGHENY CASUALTY COMPANY',
      effectiveDate: '2020-01-01', expirationDate: '2021-01-01', premium: 500 };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [base,
        ...['PENDING', 'EXPIRED', 'LAPSED', 'CANCELLED', 'NON_RENEWED', 'UNKNOWN'].map((status) => ({ ...base, id: status, status })),
        { ...base, id: 'active-quote', recordType: 'QUOTE', status: 'ACTIVE' },
        { ...base, id: 'quote', recordType: 'QUOTE', status: 'QUOTE' }], totalPages: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ ...base, id: 'wc', policyNumber: '654345', lineOfBusiness: "Workers' Compensation" }], totalPages: 2 }) });
    global.fetch = fetchMock;
    const result = await fetchPoliciesByAccount('jane@example.com', 'account-1');
    expect(result.map((policy) => policy.id)).toEqual(['llc', 'wc']);
    expect(result[0]).toMatchObject({ id: 'llc', recordType: 'POLICY', status: 'Active', lineOfBusiness: 'LLC Bond',
      policyNumber: '24312323', carrierName: 'ALLEGHENY CASUALTY COMPANY', expirationDate: '2021-01-01' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('page=2&pageSize=50'), expect.anything());
  });

  it('does not turn a failed later page into a partial or empty success', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], totalPages: 2 }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ message: 'Unavailable' }) });
    await expect(fetchPoliciesByAccount('jane@example.com', 'account-1')).rejects.toThrow('Unavailable');
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
