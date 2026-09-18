import {
  PaymentApiError,
  getPaymentEligibility,
  listPaymentEligibility,
  submitPayment,
} from '@/services/payment-api';
import { buildFinancedPaymentEligibility, buildPaymentEligibility, buildPaymentTermOption } from '@/tests/factories';

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
    const record = buildPaymentEligibility({ lineOfBusiness: '' });
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
        }),
      })
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Client-Email');
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
        paymentOptionId: null,
        termYears: null,
        status: 'SUCCEEDED',
        amount: 750,
        convenienceFee: 22.5,
        addOnConvenienceFee: 0,
        totalCharged: 772.5,
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
          Authorization: 'Bearer supabase-access-token',
          'X-Client-Account-Id': 'account-1',
          'Idempotency-Key': 'uuid-1',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(request),
      })
    );
  });

  it('accepts term options and submits only the selected opaque option ID', async () => {
    const termRecord = buildPaymentEligibility({
      paymentMode: 'TERM_OPTIONS',
      amountDue: 139,
      premium: 139,
      paidAmount: 0,
      selectedOptionId: null,
      termOptions: [
        buildPaymentTermOption(),
        buildPaymentTermOption({
          id: 'option-3',
          termYears: 3,
          amount: 330,
          label: '3 years',
          cardConvenienceFee: 9.9,
          cardTotalAmount: 339.9,
          achTotalAmount: 333,
        }),
      ],
      cardConvenienceFee: 4.17,
      cardTotalAmount: 143.17,
      achConvenienceFee: 3,
      achTotalAmount: 142,
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => termRecord })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'payment-3',
          demandId: 'demand-1',
          paymentOptionId: 'option-3',
          termYears: 3,
          status: 'SUCCEEDED',
          amount: 330,
          convenienceFee: 9.9,
          addOnConvenienceFee: 0,
          totalCharged: 339.9,
          currency: 'USD',
          purpose: 'PREMIUM',
          receiptId: 'receipt-3',
          completedAt: '2026-08-07T18:00:00.000Z',
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')
    ).resolves.toEqual(termRecord);

    const request = {
      paymentOptionId: 'option-3',
      paymentMethod: 'ACH' as const,
      emailReceipt: true as const,
      ach: {
        firstName: 'Jane',
        lastName: 'Builder',
        address1: '123 Main Street',
        country: 'United States Of America' as const,
        city: 'Los Angeles',
        region: 'California',
        postalCode: '90001',
        email: 'jane@example.com',
        achBankAccountType: 'Checking' as const,
        accountType: 'Business' as const,
        achBankName: 'Example Bank',
        achRoutingNumber: '021000021',
        achBankAccountNumber: '123456789',
      },
    };
    await submitPayment('jane@example.com', 'account-1', 'demand-1', 'uuid-term', request);

    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify(request));
    expect(request).not.toHaveProperty('amount');
    expect(request).not.toHaveProperty('purpose');
  });

  it('accepts published installment plans without payment-link timestamp metadata', async () => {
    const record = buildPaymentEligibility({
      demandId: 'installment-1',
      paymentPlanId: 'plan-1',
      paymentMode: 'INSTALLMENTS',
      planPaymentChoice: 'INSTALLMENTS_ONLY',
      fullPaymentDemandId: null,
      installmentNumber: 1,
      installmentCount: 3,
      planTotalAmount: 200,
      amountDue: 66.66,
      premium: 66.66,
      paidAmount: 0,
      installments: [
        {
          id: 'installment-1',
          installmentNumber: 1,
          amount: 66.66,
          dueDate: '2026-09-01',
          status: 'PUBLISHED',
          paymentLink: null,
          cardConvenienceFee: 2,
          cardTotalAmount: 68.66,
          achConvenienceFee: 3,
          achTotalAmount: 69.66,
        },
        {
          id: 'installment-2',
          installmentNumber: 2,
          amount: 66.66,
          dueDate: '2026-10-01',
          status: 'PUBLISHED',
          paymentLink: null,
          cardConvenienceFee: 2,
          cardTotalAmount: 68.66,
          achConvenienceFee: 3,
          achTotalAmount: 69.66,
        },
        {
          id: 'installment-3',
          installmentNumber: 3,
          amount: 66.68,
          dueDate: '2026-11-01',
          status: 'PUBLISHED',
          paymentLink: null,
          cardConvenienceFee: 2,
          cardTotalAmount: 68.68,
          achConvenienceFee: 3,
          achTotalAmount: 69.68,
        },
      ],
    });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [record], page: 1, pageSize: 50, total: 1, totalPages: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      listPaymentEligibility('jane@example.com', 'account-1', { page: 1, pageSize: 50 })
    ).resolves.toMatchObject({ data: [record] });
  });

  it('accepts legacy standalone demands that omit installment metadata', async () => {
    const {
      paymentPlanId: _paymentPlanId,
      planPaymentChoice: _planPaymentChoice,
      fullPaymentDemandId: _fullPaymentDemandId,
      installmentNumber: _installmentNumber,
      installmentCount: _installmentCount,
      planTotalAmount: _planTotalAmount,
      installments: _installments,
      dueStatus: _dueStatus,
      ...legacyRecord
    } = buildPaymentEligibility();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [legacyRecord],
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      listPaymentEligibility('jane@example.com', 'account-1', { page: 1, pageSize: 50 })
    ).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          demandId: legacyRecord.demandId,
          paymentPlanId: null,
          planPaymentChoice: null,
          fullPaymentDemandId: null,
          installmentNumber: null,
          installmentCount: null,
          planTotalAmount: null,
          installments: [],
          dueStatus: 'DUE',
        }),
      ],
    });
  });

  it('rejects eligibility that omits the server-calculated fee previews', async () => {
    const {
      cardConvenienceFee: _cardConvenienceFee,
      cardTotalAmount: _cardTotalAmount,
      achConvenienceFee: _achConvenienceFee,
      achTotalAmount: _achTotalAmount,
      ...record
    } = buildPaymentEligibility();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [record], page: 1, pageSize: 50, total: 1, totalPages: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      listPaymentEligibility('jane@example.com', 'account-1', { page: 1, pageSize: 50 })
    ).rejects.toMatchObject({
      status: 500,
      message: 'Unexpected payment eligibility response format.',
    });
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

  it('does not call the payment API without an authenticated Supabase session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(listPaymentEligibility('jane@example.com', 'account-1')).rejects.toMatchObject({
      status: 401,
      message: 'Your secure sign-in session is unavailable. Please sign in again.',
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
  it('preserves premium financing and its exact version', async () => {
    const record = buildFinancedPaymentEligibility();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => record });
    await expect(getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')).resolves.toEqual(record);
  });

  it.each([
    { pricingVersion: '' }, { pricingVersion: null }, { pricingVersion: 'not-a-version' },
    { premiumPaymentOption: 'INSTALLMENTS' },
    { financing: { fullPremium: 500, downPayment: 0, paymentCount: 10, paymentAmount: 45 } },
    { financing: { fullPremium: 500, downPayment: 500, paymentCount: 10, paymentAmount: 45 } },
    { financing: { fullPremium: 600, downPayment: 100, paymentCount: 10, paymentAmount: 45 } },
    { financing: { fullPremium: 500, downPayment: 100, paymentCount: 121, paymentAmount: 45 } },
    { financing: { fullPremium: 500, downPayment: 100, paymentCount: 1.5, paymentAmount: 45 } },
    { financing: { fullPremium: 500, downPayment: 100, paymentCount: 10, paymentAmount: -1 } },
    { financing: { fullPremium: 500, downPayment: 100, paymentCount: 10, paymentAmount: 45.001 } },
    { financedCardTotalAmount: 99 }, { financedAchTotalAmount: 104 },
    { financedCardConvenienceFee: -1 }, { financedCardConvenienceFee: Infinity },
  ])('rejects malformed premium pricing %j', async (overrides) => {
    const record = { ...buildFinancedPaymentEligibility(), ...overrides };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => record });
    await expect(getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')).rejects.toThrow(/pricing.*refresh/i);
  });

  describe('versioned premium submission', () => {
    const request = {
      premiumPaymentOption: 'FINANCED_PREMIUM' as const,
      pricingVersion: '2026-09-18T18:00:00.000Z',
      paymentMethod: 'CARD' as const, emailReceipt: true as const,
      card: {
        firstName: 'Jane', lastName: 'Builder', address1: '123 Main Street',
        country: 'United States Of America' as const, city: 'Los Angeles', region: 'California',
        postalCode: '90001', email: 'jane@example.com', creditCardType: 'Visa' as const,
        creditCardNumber: '4111111111111111', creditCardExpiration: '12/30', creditCardSecurityCode: '123',
      },
    };
    const receipt = {
      id: 'payment-1', demandId: 'demand-1', paymentOptionId: null, termYears: null,
      premiumPaymentOption: 'FINANCED_PREMIUM', status: 'SUCCEEDED', amount: 100,
      convenienceFee: 3.5, addOnConvenienceFee: 0, totalCharged: 103.5, currency: 'USD',
      purpose: 'DOWN_PAYMENT', receiptId: 'receipt-1', completedAt: '2026-09-18T18:01:00.000Z',
    };

    it('sends the selected choice and exact version through the existing authenticated endpoint', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => receipt });
      global.fetch = fetchMock;
      await expect(submitPayment('jane@example.com', 'account-1', 'demand-1', 'premium-key', request)).resolves.toEqual(receipt);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/demand-1/payments'), expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer supabase-access-token', 'Idempotency-Key': 'premium-key', 'X-Client-Account-Id': 'account-1' }),
        body: JSON.stringify(request),
      }));
    });

    it('retains a null receipt total instead of substituting a preview', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...receipt, totalCharged: null }) });
      await expect(submitPayment('jane@example.com', 'account-1', 'demand-1', 'premium-key', request)).resolves.toMatchObject({ totalCharged: null });
    });

    it.each([
      { premiumPaymentOption: 'OTHER' }, { premiumPaymentOption: null },
      { purpose: 'PREMIUM' }, { demandId: 'another-demand' },
      { amount: Infinity }, { totalCharged: NaN },
    ])('treats malformed success as uncertain: %j', async (overrides) => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...receipt, ...overrides }) });
      await expect(submitPayment('jane@example.com', 'account-1', 'demand-1', 'premium-key', request)).rejects.toMatchObject({ status: 502, outcomeUncertain: true });
    });

    it('marks transport failure uncertain without retrying or exposing instrument details', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network failed'));
      await expect(submitPayment('jane@example.com', 'account-1', 'demand-1', 'premium-key', request)).rejects.toMatchObject({ status: 502, outcomeUncertain: true });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects invalid financing on a coverage term rather than borrowing root pricing', async () => {
    const record = {
      ...buildFinancedPaymentEligibility(), paymentMode: 'TERM_OPTIONS',
      termOptions: [buildPaymentTermOption(), buildPaymentTermOption({
        id: 'term-2', termYears: 2,
        financing: { fullPremium: 500, downPayment: 100, paymentCount: 10, paymentAmount: 45 },
      })],
    };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => record });
    await expect(getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')).rejects.toThrow(/pricing.*refresh/i);
  });

  it('rejects a full-payment preview that does not match its premium plus fee', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...buildFinancedPaymentEligibility(), cardTotalAmount: 999 }) });
    await expect(getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')).rejects.toThrow(/pricing.*refresh/i);
  });

  it('accepts unavailable financed previews without treating them as zero', async () => {
    const record = { ...buildFinancedPaymentEligibility(), financedCardConvenienceFee: undefined, financedCardTotalAmount: undefined };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => record });
    await expect(getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')).resolves.toMatchObject({ financing: record.financing });
  });

  it.each(['FULL_PREMIUM_ONLY', 'FINANCED_PREMIUM_ONLY', 'BOTH', null, undefined])('retains the saved offer %s', async (offer) => {
    const record = { ...buildFinancedPaymentEligibility(), premiumPaymentOffer: offer };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => record });
    await expect(getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')).resolves.toEqual(record);
  });

  it.each(['UNKNOWN', '', false, 1, {}])('rejects an unknown premium offer %j', async (offer) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...buildFinancedPaymentEligibility(), premiumPaymentOffer: offer }) });
    await expect(getPaymentEligibility('jane@example.com', 'account-1', 'demand-1')).rejects.toThrow(/pricing.*refresh/i);
  });

});
