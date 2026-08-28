import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/auth-context';
import { PaymentApiError, listPaymentEligibility } from '@/services/payment-api';
import type { PaymentEligibility } from '@/types/payment';

type PaymentsContextValue = {
  paymentRecords: PaymentEligibility[];
  payableRecords: PaymentEligibility[];
  isLoadingPayments: boolean;
  paymentsError: string | null;
  refreshPaymentEligibility: () => Promise<void>;
};

const PaymentsContext = createContext<PaymentsContextValue | undefined>(undefined);

function toUserFacingError(error: unknown) {
  if (error instanceof PaymentApiError) {
    if (error.status === 401) {
      return 'Your secure sign-in session is unavailable. Please sign in again.';
    }
    if (error.status === 503) {
      return 'Mobile payments are temporarily unavailable. Please try again later.';
    }
    if (error.status >= 500) {
      return 'Unable to load payment information right now. Please try again later.';
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to load payment information right now.';
}

export function PaymentsProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, userEmail, customer } = useAuth();
  const [paymentRecords, setPaymentRecords] = useState<PaymentEligibility[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const refreshPaymentEligibility = useCallback(async () => {
    const signedInEmail = userEmail?.trim();
    const accountId = customer?.accountId?.trim() || customer?.databaseId?.trim() || '';
    if (!isAuthenticated || !signedInEmail || !accountId) {
      setPaymentRecords([]);
      setPaymentsError(null);
      setIsLoadingPayments(false);
      return;
    }

    setIsLoadingPayments(true);
    setPaymentsError(null);
    try {
      const firstPage = await listPaymentEligibility(signedInEmail, accountId, {
        page: 1,
        pageSize: 50,
      });
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          listPaymentEligibility(signedInEmail, accountId, {
            page: index + 2,
            pageSize: 50,
          })
        )
      );
      const allRecords = [
        ...firstPage.data,
        ...remainingPages.flatMap((response) => response.data),
      ];
      setPaymentRecords(allRecords.filter((record) => record.accountId === accountId));
    } catch (error) {
      setPaymentRecords([]);
      setPaymentsError(toUserFacingError(error));
    } finally {
      setIsLoadingPayments(false);
    }
  }, [customer?.accountId, customer?.databaseId, isAuthenticated, userEmail]);

  useEffect(() => {
    void refreshPaymentEligibility();
  }, [refreshPaymentEligibility]);

  const payableRecords = useMemo(() => {
    const planRecords = new Map<string, PaymentEligibility>();
    const standaloneRecords: PaymentEligibility[] = [];

    for (const record of paymentRecords) {
      const payable =
        record.paymentState === 'DUE' &&
        record.paymentNeeded &&
        (record.paymentMode === 'TERM_OPTIONS'
          ? record.termOptions.length >= 2 && record.termOptions.some((option) => option.amount > 0)
          : record.amountDue > 0);
      if (!payable) continue;
      if (!record.paymentPlanId) {
        standaloneRecords.push(record);
        continue;
      }

      const current = planRecords.get(record.paymentPlanId);
      // The parent demand is the single card shown for a plan. If an older
      // plan has no parent, retain the first payable installment so the
      // client can still open its schedule and pay the next installment.
      if (!current || (record.installmentNumber === null && current.installmentNumber !== null)) {
        planRecords.set(record.paymentPlanId, record);
      }
    }

    return [...standaloneRecords, ...planRecords.values()];
  }, [paymentRecords]);

  const value = useMemo<PaymentsContextValue>(
    () => ({
      paymentRecords,
      payableRecords,
      isLoadingPayments,
      paymentsError,
      refreshPaymentEligibility,
    }),
    [
      isLoadingPayments,
      payableRecords,
      paymentRecords,
      paymentsError,
      refreshPaymentEligibility,
    ]
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const context = useContext(PaymentsContext);
  if (!context) {
    throw new Error('usePayments must be used inside PaymentsProvider.');
  }
  return context;
}
