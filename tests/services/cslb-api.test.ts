import { buildCslbLicenseUrl, fetchClientCslb, refreshClientCslb } from '@/services/cslb-api';

describe('PBIA CSLB api', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://localhost:3000';
  });

  it('builds an official fallback CSLB URL', () => {
    expect(buildCslbLicenseUrl(' 1144038 ')).toBe(
      'https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=1144038'
    );
  });

  it('loads an email-scoped CSLB summary', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recordType: 'LICENSE',
        number: '1144038',
        sourceUrl: 'https://cslb.example/license',
        summary: {
          sourceUrl: 'https://cslb.example/license',
          licenseNumber: '1144038',
          dataCurrentAsOf: 'Aug 5, 2026',
          status: 'Active',
          issueDate: 'Jan 1, 2020',
          expireDate: 'Jan 1, 2027',
          classifications: ['B'],
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const license = await fetchClientCslb('jane@example.com', 'account-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/cslb?accountId=account-1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(license).toEqual(
      expect.objectContaining({ licenseNumber: '1144038', status: 'Active', classifications: ['B'] })
    );
  });

  it('uses the refresh endpoint on explicit refresh', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recordType: 'APPLICATION_FEE',
        number: '20260101061',
        sourceUrl: 'https://cslb.example/application',
        summary: null,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await refreshClientCslb('jane@example.com', 'account-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/cslb/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ accountId: 'account-1' }),
      })
    );
  });
});
