import {
  PaymentApiError,
  getPaymentEligibility,
  listPaymentEligibility,
  submitPayment,
} from '@/services/payment-api';
import { buildPaymentEligibility } from '@/tests/factories';

const ORIGINAL_PAYMENT_BASE_URL = process.env.EXPO_PUBLIC_PBIA_API_BASE_URL;
const mockGetSession = jest.fn();

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getSession: () => mockGetSession() },
  }),
}));

describe('payment API', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'https://pbia-api.example.com';
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-access-token',
          user: { email: 'jane@example.com' },
        },
      },
      error: null,
    });
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = ORIGINAL_PAYMENT_BASE_URL;
  });

  it('lists email-scoped payment eligibility', async () => {
    const record = buildPaymentEligibility();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [record], page: 1, pageSize: 50, total: 1, totalPages: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await listPaymentEligibility(' Jane@Example.com ', 'account-1', {
      page: 1,
      pageSize: 50,
    });

    expect(result.data).toEqual([record]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pbia-api.example.com/client/payment-eligibility?accountId=account-1&page=1&pageSize=50',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer supabase-access-token',
          'X-Client-Email': 'jane@example.com',
        }),
      })
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('x-api-key');
  });

  it('loads one email-scoped demand using the selected account', async () => {
    const record = buildPaymentEligibility({ demandId: 'demand/one' });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => record });
    global.fetch = fetchMock as unknown as typeof fetch;

    await getPaymentEligibility('jane@example.com', 'account-1', 'demand/one');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pbia-api.example.com/client/payment-eligibility/demand%2Fone',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Client-Account-Id': 'account-1' }),
      })
    );
  });

  it('submits only the approved payment fields with an idempotency key', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'payment-1',
        demandId: 'demand-1',
        status: 'SUCCEEDED',
        amount: 750,
        currency: 'USD',
        purpose: 'PREMIUM',
        receiptId: 'receipt-1',
        completedAt: '2026-08-05T18:00:00.000Z',
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const request = {
      amount: 750,
      purpose: 'PREMIUM' as const,
      paymentMethod: 'CARD' as const,
      emailReceipt: true as const,
      card: {
        firstName: 'Jane',
        lastName: 'Builder',
        address1: '123 Main Street',
        country: 'United States Of America' as const,
        city: 'Los Angeles',
        region: 'California',
        postalCode: '90001',
        email: 'jane@example.com',
        creditCardType: 'Visa' as const,
        creditCardNumber: '4111111111111111',
        creditCardExpiration: '12/30',
        creditCardSecurityCode: '123',
      },
    };

    await submitPayment('jane@example.com', 'account-1', 'demand-1', 'uuid-1', request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pbia-api.example.com/client/payment-eligibility/demand-1/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Client-Email': 'jane@example.com',
          'X-Client-Account-Id': 'account-1',
          'Idempotency-Key': 'uuid-1',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(request),
      })
    );
  });

  it('rejects insecure API URLs before sending payment data', async () => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://pbia-api.example.com';
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(listPaymentEligibility('jane@example.com', 'account-1')).rejects.toMatchObject({
      status: 503,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows loopback HTTP for local Expo development', async () => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://localhost:4010';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await listPaymentEligibility('jane@example.com', 'account-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4010/client/payment-eligibility?accountId=account-1&page=1&pageSize=20',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('rejects a client email that does not match the authenticated Supabase session', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(listPaymentEligibility('different@example.com', 'account-1')).rejects.toMatchObject({
      status: 401,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('treats any non-SUCCEEDED response as unconfirmed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'PENDING' }),
    }) as unknown as typeof fetch;

    await expect(
      submitPayment('jane@example.com', 'account-1', 'demand-1', 'uuid-1', {
        amount: 10,
        purpose: 'OTHER',
        paymentMethod: 'ACH',
        emailReceipt: true,
        ach: {
          firstName: 'Jane',
          lastName: 'Builder',
          address1: '123 Main Street',
          country: 'United States Of America',
          city: 'Los Angeles',
          region: 'California',
          postalCode: '90001',
          email: 'jane@example.com',
          achBankAccountType: 'Checking',
          accountType: 'Business',
          achBankName: 'Bank',
          achRoutingNumber: '021000021',
          achBankAccountNumber: '1234',
        },
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<PaymentApiError>>({
        status: 502,
        message: 'We could not confirm your payment. Please contact PBIA before trying again.',
      })
    );
  });
});
