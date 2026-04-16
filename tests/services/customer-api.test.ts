import { fetchCustomersByEmail, updateInsuredProfile } from '@/services/customer-api';

describe('customer api', () => {
  const originalCustomerApiBaseUrl = process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL;
  const originalPublicApiKey = process.env.EXPO_PUBLIC_X_API_KEY;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL = 'http://localhost:3500';
    process.env.EXPO_PUBLIC_X_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL = originalCustomerApiBaseUrl;
    process.env.EXPO_PUBLIC_X_API_KEY = originalPublicApiKey;
  });

  it('looks up customers by email through the configured backend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ databaseId: 'insured-db-1' }],
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchCustomersByEmail('jane@example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3500/getCustomer?Email=jane%40example.com',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-api-key': 'test-api-key',
        }),
      })
    );
  });

  it('posts profile edits to the NowCerts addCustomer endpoint and restores the business name', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    await updateInsuredProfile({
      databaseId: 'insured-db-1',
      type: 0,
      commercialName: 'Builder Co',
      firstName: 'Jane',
      lastName: 'Builder',
      email: 'jane@example.com',
      phone: '5551112222',
      cellPhone: '5559990000',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3500/addCustomer',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        }),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      databaseId: 'insured-db-1',
      eMail: 'jane@example.com',
      type: 0,
      commercialName: 'Builder Co',
      firstName: 'Jane',
      lastName: 'Builder',
      phone: '5551112222',
      cellPhone: '5559990000',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3500/addCustomer',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      databaseId: 'insured-db-1',
      eMail: 'jane@example.com',
      type: 0,
      commercialName: 'Builder Co',
      phone: '5551112222',
      cellPhone: '5559990000',
    });
  });
});
