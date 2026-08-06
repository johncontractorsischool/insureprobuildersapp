import React, { PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';

import { PaymentsProvider, usePayments } from '@/context/payments-context';
import { buildPaymentEligibility } from '@/tests/factories';
import { buildCustomer } from '@/tests/factories';

const mockUseAuth = jest.fn();
const mockListPaymentEligibility = jest.fn();

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/payment-api', () => ({
  PaymentApiError: class PaymentApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  listPaymentEligibility: (
    email: string,
    accountId: string,
    options?: { page?: number; pageSize?: number }
  ) => mockListPaymentEligibility(email, accountId, options),
}));

function wrapper({ children }: PropsWithChildren) {
  return <PaymentsProvider>{children}</PaymentsProvider>;
}

describe('PaymentsProvider', () => {
  it('loads every eligibility page with the signed-in email and exposes only payable records', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userEmail: 'jane@example.com',
      customer: buildCustomer({ accountId: 'account-1' }),
    });
    mockListPaymentEligibility
      .mockResolvedValueOnce({
        data: [buildPaymentEligibility({ demandId: 'demand-1', recordId: 'due-policy' })],
        page: 1,
        pageSize: 50,
        total: 2,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        data: [
          buildPaymentEligibility({ demandId: 'demand-2', recordId: 'due-quote' }),
        ],
        page: 2,
        pageSize: 50,
        total: 2,
        totalPages: 2,
      });

    const { result } = renderHook(() => usePayments(), { wrapper });

    await waitFor(() => expect(mockListPaymentEligibility).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoadingPayments).toBe(false));

    expect(mockListPaymentEligibility).toHaveBeenNthCalledWith(1, 'jane@example.com', 'account-1', {
      page: 1,
      pageSize: 50,
    });
    expect(mockListPaymentEligibility).toHaveBeenNthCalledWith(2, 'jane@example.com', 'account-1', {
      page: 2,
      pageSize: 50,
    });
    expect(result.current.paymentRecords).toHaveLength(2);
    expect(result.current.payableRecords.map((record) => record.demandId)).toEqual([
      'demand-1',
      'demand-2',
    ]);
  });

  it('does not call the payment API without an authenticated email', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, userEmail: null, customer: null });

    const { result } = renderHook(() => usePayments(), { wrapper });

    await waitFor(() => expect(result.current.isLoadingPayments).toBe(false));
    expect(mockListPaymentEligibility).not.toHaveBeenCalled();
    expect(result.current.paymentRecords).toEqual([]);
  });
});
