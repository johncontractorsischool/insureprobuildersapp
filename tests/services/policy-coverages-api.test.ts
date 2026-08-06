import { fetchPolicyCoverages } from '@/services/policy-coverages-api';

describe('PBIA policy coverages api', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://localhost:3000';
  });

  it('maps PBIA coverage records into readable groups', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'coverage-1',
            name: 'General Liability',
            limitAmount: 1_000_000,
            premium: 1000,
            coverageCode: 'GL',
          },
        ],
        total: 1,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const groups = await fetchPolicyCoverages('jane@example.com', 'account-1', 'policy-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/policies/policy-1/coverages?accountId=account-1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(groups[0]).toEqual({
      id: 'coverage-1',
      title: 'General Liability',
      rows: [
        { label: 'Coverage Code', value: 'GL' },
        { label: 'Limit', value: '$1,000,000' },
        { label: 'Premium', value: '$1,000' },
      ],
    });
  });
});
