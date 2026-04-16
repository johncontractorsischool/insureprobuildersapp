import { fetchPoliciesByInsuredDatabaseId } from '@/services/policy-api';

describe('fetchPoliciesByInsuredDatabaseId', () => {
  it('maps and sorts policy records from wrapped api data', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            databaseId: 'policy-older',
            number: 'GL-1001',
            isQuote: false,
            effectiveDate: '2026-01-01T00:00:00.000Z',
            expirationDate: '2026-12-31T00:00:00.000Z',
            insuredFirstName: 'Jane',
            insuredLastName: 'Builder',
            insuredCommercialName: null,
            linesOfBusiness: ['General Liability'],
            carrierName: 'Carrier One',
            totalPremium: 1000,
            changeDate: '2026-02-01T00:00:00.000Z',
            active: true,
            status: 'active',
            inceptionDate: null,
            createDate: null,
            billingType: 0,
          },
          {
            databaseId: 'policy-newer',
            number: 'WC-2002',
            isQuote: true,
            effectiveDate: '2026-04-01T00:00:00.000Z',
            expirationDate: '2027-04-01T00:00:00.000Z',
            insuredFirstName: null,
            insuredLastName: null,
            insuredCommercialName: 'Builder Co',
            linesOfBusiness: ['Workers Compensation'],
            carrierName: 'Carrier Two',
            totalPremium: 2200,
            changeDate: null,
            active: false,
            status: 'quoted',
            inceptionDate: null,
            createDate: null,
            billingType: 1,
          },
        ],
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const policies = await fetchPoliciesByInsuredDatabaseId('insured-db-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/getPolicy?IId=insured-db-1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(policies.map((policy) => policy.id)).toEqual(['policy-newer', 'policy-older']);
    expect(policies[0]).toEqual(
      expect.objectContaining({
        status: 'Pending',
        policyNumber: 'WC-2002',
        carrierName: 'Carrier Two',
        expirationDate: '2027-04-01T00:00:00.000Z',
        insuredName: 'Builder Co',
        billing: expect.objectContaining({
          plan: 'Carrier billed',
        }),
      })
    );
  });

  it('throws when the payload format is invalid', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: true }),
    }) as unknown as typeof fetch;

    await expect(fetchPoliciesByInsuredDatabaseId('insured-db-1')).rejects.toThrow(
      'Unexpected policy lookup response format.'
    );
  });
});
