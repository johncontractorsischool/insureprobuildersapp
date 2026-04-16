import { fetchPolicyCoveragesByPolicyId } from '@/services/policy-coverages-api';

describe('policy-coverages api', () => {
  it('maps nowcerts coverages into readable coverage groups', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          workerCompAndEmployersLiabilitiesCoverages: [
            {
              databaseId: 'coverage-1',
              lineOfBusinessId: 'lob-1',
              policyId: 'policy-1',
              lineOfBusinessName: "Worker's Compensation",
              createDate: '2026-04-10T11:13:00',
              changeDate: '2026-04-10T11:13:00',
              memberExcluded: false,
              limitWCStatLimits: false,
              limitOtherCheckbox: false,
              limitOtherValue: '',
              limitEachAccident: '1000000',
              limitEAEmployee: 1000000,
              limitPolicy: '$1,000,000',
            },
          ],
        },
      ],
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const groups = await fetchPolicyCoveragesByPolicyId('policy-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3500/get-coverages?policyId=policy-1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(groups).toEqual([
      {
        id: 'coverage-1',
        title: "Worker's Compensation",
        rows: [
          { label: 'Each Accident Limit', value: '$1,000,000' },
          { label: 'Each Employee Limit', value: '$1,000,000' },
          { label: 'Policy Limit', value: '$1,000,000' },
        ],
      },
    ]);
  });

  it('rejects requests without a policy id', async () => {
    await expect(fetchPolicyCoveragesByPolicyId('')).rejects.toThrow(
      'Missing policy id for policy coverages lookup.'
    );
  });
});
