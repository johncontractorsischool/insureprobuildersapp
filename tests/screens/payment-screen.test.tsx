import React from 'react';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { PaymentEligibility } from '@/types/payment';

import {
  buildCustomer,
  buildFinancedPaymentEligibility,
  buildPaymentEligibility,
  buildPaymentTermOption,
} from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
const mockUseAuth = jest.fn();
const mockUsePayments = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockGetPaymentEligibility = jest.fn();
const mockSubmitPayment = jest.fn();
const mockRefreshPaymentEligibility = jest.fn();
const mockRandomUUID = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockPreventScreenCapture = jest.fn((_key?: string) => Promise.resolve());
const mockAllowScreenCapture = jest.fn((_key?: string) => Promise.resolve());
const mockEnableAppSwitcherProtection = jest.fn(() => Promise.resolve());
const mockDisableAppSwitcherProtection = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
  useFocusEffect: (callback: () => void) => callback(),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => mockRandomUUID(),
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: (key: string) => mockPreventScreenCapture(key),
  allowScreenCaptureAsync: (key: string) => mockAllowScreenCapture(key),
  enableAppSwitcherProtectionAsync: () => mockEnableAppSwitcherProtection(),
  disableAppSwitcherProtectionAsync: () => mockDisableAppSwitcherProtection(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/context/payments-context', () => ({
  usePayments: () => mockUsePayments(),
}));
jest.mock('@/services/payment-api', () => {
  class MockPaymentApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  return {
    PaymentApiError: MockPaymentApiError,
    getPaymentEligibility: (...args: unknown[]) => mockGetPaymentEligibility(...args),
    submitPayment: (...args: unknown[]) => mockSubmitPayment(...args),
  };
});

const PaymentScreen = require('@/app/payment').default;

describe('PaymentScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPreventScreenCapture.mockResolvedValue(undefined);
    mockAllowScreenCapture.mockResolvedValue(undefined);
    mockEnableAppSwitcherProtection.mockResolvedValue(undefined);
    mockDisableAppSwitcherProtection.mockResolvedValue(undefined);
    mockRandomUUID
      .mockReturnValueOnce('740f67f1-71bf-44b6-ae37-f42e728998d7')
      .mockReturnValue('different-payment-key');
    mockDigestStringAsync.mockResolvedValue('payment-intent-hash');
    mockRouter.canGoBack.mockReturnValue(true);
    mockUseLocalSearchParams.mockReturnValue({});
    const payableRecord = buildPaymentEligibility({
      purpose: 'DOWN_PAYMENT',
      cardConvenienceFee: 37.46,
      cardTotalAmount: 1285.96,
    });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      customer: buildCustomer({
        accountId: 'account-1',
        addressLine1: '123 Main Street',
        addressLine2: 'Suite 100',
        city: 'Los Angeles',
        stateNameOrAbbreviation: 'CA',
        zipCode: '90001',
      }),
      userEmail: 'jane@example.com',
    });
    mockUsePayments.mockReturnValue({
      paymentRecords: [payableRecord],
      payableRecords: [payableRecord],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: mockRefreshPaymentEligibility,
    });
    mockGetPaymentEligibility.mockResolvedValue(payableRecord);
    mockSubmitPayment.mockResolvedValue({
      id: 'payment-request-1',
      demandId: 'demand-1',
      paymentOptionId: null,
      termYears: null,
      status: 'SUCCEEDED',
      amount: 1248.5,
      convenienceFee: 37.46,
      addOnConvenienceFee: 0,
      totalCharged: 1285.96,
      currency: 'USD',
      purpose: 'DOWN_PAYMENT',
      receiptId: 'input1-receipt-1',
      completedAt: '2026-08-05T18:00:00.000Z',
    });
    mockRefreshPaymentEligibility.mockResolvedValue(undefined);
  });

  it('reviews and submits a card payment using the signed-in email and a unique key', async () => {
    const { getAllByText, getByLabelText, getByText, findByRole, findByText } = render(<PaymentScreen />);

    await waitFor(() => expect(getAllByText('$1,248.50').length).toBeGreaterThan(0));
    expect(getByLabelText('Receipt Email')).toHaveProp('editable', false);
    expect(getByLabelText('Receipt Email')).toHaveProp('value', 'jane@example.com');

    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));

    const confirmButton = await findByRole('button', { name: 'Confirm Payment' });
    expect(getAllByText('Card convenience fee').length).toBeGreaterThan(0);
    expect(getAllByText('$37.46').length).toBeGreaterThan(0);
    expect(getByText('Total charged')).toBeTruthy();
    expect(getAllByText('$1,285.96').length).toBeGreaterThan(0);
    expect(mockGetPaymentEligibility).toHaveBeenCalledWith(
      'jane@example.com',
      'account-1',
      'demand-1'
    );

    fireEvent.press(confirmButton);

    expect(await findByText('Payment successful')).toBeTruthy();
    expect(getByText('input1-receipt-1')).toBeTruthy();
    expect(getByText('Convenience fee')).toBeTruthy();
    expect(getByText('Total charged')).toBeTruthy();
    expect(mockSubmitPayment).toHaveBeenCalledWith(
      'jane@example.com',
      'account-1',
      'demand-1',
      '740f67f1-71bf-44b6-ae37-f42e728998d7',
      expect.objectContaining({
        amount: 1248.5,
        purpose: 'DOWN_PAYMENT',
        paymentMethod: 'CARD',
        emailReceipt: true,
        card: expect.objectContaining({
          email: 'jane@example.com',
          region: 'California',
          country: 'United States Of America',
          creditCardType: 'Visa',
          creditCardNumber: '4111111111111111',
        }),
      })
    );
    expect(mockRefreshPaymentEligibility).toHaveBeenCalled();
  });

  it.each([
    ['3', 'AmericanExpress'],
    ['4', 'Visa'],
    ['5', 'Mastercard'],
    ['6', 'Discover'],
  ])('detects a %s card as %s in the background', async (firstDigit, expectedCardType) => {
    const {
      findByRole,
      findByText,
      getByLabelText,
      getByText,
      queryByLabelText,
      queryByText,
    } = render(<PaymentScreen />);

    expect(queryByLabelText('Card Type')).toBeNull();
    expect(queryByText('Detected from card number')).toBeNull();
    fireEvent.changeText(getByLabelText('Card Number'), `${firstDigit}111111111111111`);
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));
    expect(await findByText('Credit card ending in 1111')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Confirm Payment' }));
    expect(await findByText('Payment successful')).toBeTruthy();
    expect(mockSubmitPayment.mock.calls[0][4].card.creditCardType).toBe(expectedCardType);
  });

  it('shows the exact agent-authored amount and purpose without editable controls', async () => {
    const { getAllByText, queryByLabelText } = render(<PaymentScreen />);

    await waitFor(() => expect(getAllByText('$1,248.50').length).toBeGreaterThan(0));
    expect(getAllByText('Down Payment').length).toBeGreaterThan(0);
    expect(queryByLabelText('Payment Amount')).toBeNull();
  });

  it('keeps the payment summary compact on mobile', () => {
    const { getByTestId } = render(<PaymentScreen />);
    const summaryStyle = StyleSheet.flatten(getByTestId('payment-summary-card').props.style);

    expect(summaryStyle).toEqual(
      expect.objectContaining({ width: '100%', padding: 16 })
    );
    expect(summaryStyle.flex).toBeUndefined();
    expect(summaryStyle.minWidth).toBeUndefined();
  });

  it('requires a quote term and submits only its payment option ID', async () => {
    const termRecord = buildPaymentEligibility({
      recordType: 'QUOTE',
      recordId: 'quote-1',
      policyNumber: null,
      paymentMode: 'TERM_OPTIONS',
      amountDue: 139,
      premium: 139,
      paidAmount: 0,
      purpose: 'PREMIUM',
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
    mockUsePayments.mockReturnValue({
      paymentRecords: [termRecord],
      payableRecords: [termRecord],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: mockRefreshPaymentEligibility,
    });
    mockGetPaymentEligibility.mockResolvedValue(termRecord);
    mockSubmitPayment.mockResolvedValue({
      id: 'payment-request-3',
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
      receiptId: 'input1-receipt-3',
      completedAt: '2026-08-07T18:00:00.000Z',
    });

    const { findByRole, findByText, getAllByText, getByLabelText, getByText, queryByText } = render(<PaymentScreen />);

    expect(await findByRole('button', { name: 'Review Payment' })).toBeDisabled();
    fireEvent.press(getByLabelText('3 years, $330.00'));
    expect(queryByText('Card total $339.90 • ACH total $333.00')).toBeNull();
    expect(getAllByText('3% Processing Fee').length).toBeGreaterThan(0);
    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));
    fireEvent.press(await findByRole('button', { name: 'Confirm Payment' }));

    expect(await findByText('input1-receipt-3')).toBeTruthy();
    const submittedRequest = mockSubmitPayment.mock.calls[0][4];
    expect(submittedRequest).toEqual(
      expect.objectContaining({
        paymentOptionId: 'option-3',
        paymentMethod: 'CARD',
        emailReceipt: true,
      })
    );
    expect(submittedRequest).not.toHaveProperty('amount');
    expect(submittedRequest).not.toHaveProperty('purpose');
  });

  it('stops review when the selected quote term changed on PBIA', async () => {
    const optionOne = buildPaymentTermOption();
    const optionThree = buildPaymentTermOption({
      id: 'option-3',
      termYears: 3,
      amount: 330,
      label: '3 years',
      cardConvenienceFee: 9.9,
      cardTotalAmount: 339.9,
      achTotalAmount: 333,
    });
    const termRecord = buildPaymentEligibility({
      recordType: 'QUOTE',
      paymentMode: 'TERM_OPTIONS',
      amountDue: 139,
      premium: 139,
      paidAmount: 0,
      selectedOptionId: null,
      termOptions: [optionOne, optionThree],
      cardConvenienceFee: 4.17,
      cardTotalAmount: 143.17,
      achConvenienceFee: 3,
      achTotalAmount: 142,
    });
    const refreshedRecord = buildPaymentEligibility({
      ...termRecord,
      termOptions: [
        optionOne,
        buildPaymentTermOption({
          ...optionThree,
          id: 'option-3-updated',
          amount: 350,
          cardConvenienceFee: 10.5,
          cardTotalAmount: 360.5,
          achTotalAmount: 353,
        }),
      ],
    });
    mockUsePayments.mockReturnValue({
      paymentRecords: [termRecord],
      payableRecords: [termRecord],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: mockRefreshPaymentEligibility,
    });
    mockGetPaymentEligibility.mockResolvedValue(refreshedRecord);

    const { findByText, getByLabelText, getByText } = render(<PaymentScreen />);

    fireEvent.press(getByLabelText('3 years, $330.00'));
    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));

    expect(
      await findByText(
        'The payment request changed. Please review the updated amount, purpose, and term options.'
      )
    ).toBeTruthy();
    expect(mockRefreshPaymentEligibility).toHaveBeenCalled();
    expect(mockSubmitPayment).not.toHaveBeenCalled();
  });

  it('selects the demand opened from its dashboard card', async () => {
    const first = buildPaymentEligibility({ demandId: 'demand-1' });
    const second = buildPaymentEligibility({
      demandId: 'demand-2',
      recordId: 'quote-2',
      recordType: 'QUOTE',
      amountDue: 500,
    });
    mockUseLocalSearchParams.mockReturnValue({ demandId: 'demand-2' });
    mockUsePayments.mockReturnValue({
      paymentRecords: [first, second],
      payableRecords: [first, second],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: mockRefreshPaymentEligibility,
    });

    const { getAllByRole } = render(<PaymentScreen />);

    await waitFor(() => {
      const options = getAllByRole('radio');
      expect(options[1].props.accessibilityState).toEqual(
        expect.objectContaining({ checked: true })
      );
    });
  });

  it('submits ACH without including a card instrument', async () => {
    mockSubmitPayment.mockResolvedValue({
      id: 'payment-request-1',
      demandId: 'demand-1',
      paymentOptionId: null,
      termYears: null,
      status: 'SUCCEEDED',
      amount: 1248.5,
      convenienceFee: 3,
      addOnConvenienceFee: 0,
      totalCharged: 1251.5,
      currency: 'USD',
      purpose: 'DOWN_PAYMENT',
      receiptId: 'input1-receipt-ach-1',
      completedAt: '2026-08-05T18:00:00.000Z',
    });
    const { getAllByText, getByLabelText, getByText, findByRole, findByText } = render(<PaymentScreen />);

    await waitFor(() => expect(getAllByText('$1,248.50').length).toBeGreaterThan(0));
    fireEvent.press(getByText('Bank Account (ACH)'));
    fireEvent.changeText(getByLabelText('Bank Name'), 'Example Bank');
    fireEvent.changeText(getByLabelText('Routing Number'), '021000021');
    fireEvent.changeText(getByLabelText('Bank Account Number'), '123456789');
    fireEvent.press(getByText('Review Payment'));
    const confirmButton = await findByRole('button', { name: 'Confirm Payment' });
    expect(getAllByText('ACH convenience fee').length).toBeGreaterThan(0);
    expect(getAllByText('$3.00').length).toBeGreaterThan(0);
    expect(getAllByText('$1,251.50').length).toBeGreaterThan(0);
    fireEvent.press(confirmButton);

    expect(await findByText('Payment successful')).toBeTruthy();
    const submittedRequest = mockSubmitPayment.mock.calls[0][4];
    expect(submittedRequest).toEqual(
      expect.objectContaining({
        paymentMethod: 'ACH',
        ach: expect.objectContaining({
          achBankAccountType: 'Checking',
          accountType: 'Business',
          achRoutingNumber: '021000021',
          achBankAccountNumber: '123456789',
        }),
      })
    );
    expect(submittedRequest).not.toHaveProperty('card');
  });

  it('clears credentials and blocks resubmission when PBIA cannot confirm the charge', async () => {
    const { PaymentApiError } = require('@/services/payment-api');
    const currentRecord = mockUsePayments().payableRecords[0];
    mockGetPaymentEligibility
      .mockResolvedValueOnce(currentRecord)
      .mockResolvedValueOnce(currentRecord)
      .mockRejectedValueOnce(new PaymentApiError(404, 'Payment demand was not found'));
    mockSubmitPayment.mockRejectedValue(
      new PaymentApiError(
        502,
        'We could not confirm your payment. Please contact PBIA before trying again.'
      )
    );
    const { getAllByText, getByLabelText, getByText, findByRole, findByText } = render(<PaymentScreen />);

    await waitFor(() => expect(getAllByText('$1,248.50').length).toBeGreaterThan(0));
    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));
    fireEvent.press(await findByRole('button', { name: 'Confirm Payment' }));

    expect(
      await findByText(
        'We could not confirm your payment. Please contact PBIA before trying again.'
      )
    ).toBeTruthy();
    expect(getByLabelText('Card Number')).toHaveProp('value', '');
    expect(await findByRole('button', { name: 'Review Payment' })).toBeDisabled();
    expect(mockSubmitPayment).toHaveBeenCalledTimes(1);
  });

  it('allows a different payer to retry when PBIA republishes a definitely rejected payment', async () => {
    const { PaymentApiError } = require('@/services/payment-api');
    mockDigestStringAsync
      .mockResolvedValueOnce('original-payer-payment-intent')
      .mockResolvedValueOnce('replacement-payer-payment-intent');
    mockSubmitPayment
      .mockRejectedValueOnce(
        new PaymentApiError(
          502,
          'Input1 payment request failed: Input1 pay request failed with HTTP 400'
        )
      )
      .mockResolvedValueOnce({
        id: 'payment-request-2',
        demandId: 'demand-1',
        paymentOptionId: null,
        termYears: null,
        status: 'SUCCEEDED',
        amount: 1248.5,
        convenienceFee: 37.46,
        addOnConvenienceFee: 0,
        totalCharged: 1285.96,
        currency: 'USD',
        purpose: 'DOWN_PAYMENT',
        receiptId: 'input1-receipt-2',
        completedAt: '2026-08-05T18:05:00.000Z',
      });
    const { getAllByText, getByLabelText, getByText, findByRole, findByText } = render(<PaymentScreen />);

    await waitFor(() => expect(getAllByText('$1,248.50').length).toBeGreaterThan(0));
    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));
    fireEvent.press(await findByRole('button', { name: 'Confirm Payment' }));

    expect(
      await findByText(
        'Your payment was not accepted. Verify the cardholder and billing information, then try again. Your card was not charged.'
      )
    ).toBeTruthy();
    expect(getByLabelText('First Name')).toHaveProp('value', 'Jane');
    expect(getByLabelText('Address')).toHaveProp('value', '123 Main Street');
    expect(getByLabelText('Card Number')).toHaveProp('value', '');

    fireEvent.changeText(getByLabelText('First Name'), 'Grace');
    fireEvent.changeText(getByLabelText('Last Name'), 'Hopper');
    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));
    fireEvent.press(await findByRole('button', { name: 'Confirm Payment' }));

    expect(await findByText('input1-receipt-2')).toBeTruthy();
    expect(mockSubmitPayment).toHaveBeenCalledTimes(2);
    expect(mockSubmitPayment.mock.calls[1][3]).not.toBe(mockSubmitPayment.mock.calls[0][3]);
    expect(mockSubmitPayment.mock.calls[1][4]).toEqual(
      expect.objectContaining({
        card: expect.objectContaining({ firstName: 'Grace', lastName: 'Hopper' }),
      })
    );
    expect(mockRefreshPaymentEligibility).toHaveBeenCalled();
  });

  it('reuses the idempotency key only when the exact failed payment is re-entered', async () => {
    const { PaymentApiError } = require('@/services/payment-api');
    mockSubmitPayment
      .mockRejectedValueOnce(new PaymentApiError(500, 'Unexpected server error'))
      .mockResolvedValueOnce({
        id: 'payment-request-2',
        demandId: 'demand-1',
        paymentOptionId: null,
        termYears: null,
        status: 'SUCCEEDED',
        amount: 1248.5,
        convenienceFee: 37.46,
        addOnConvenienceFee: 0,
        totalCharged: 1285.96,
        currency: 'USD',
        purpose: 'DOWN_PAYMENT',
        receiptId: 'input1-receipt-2',
        completedAt: '2026-08-05T18:05:00.000Z',
      });
    const { getAllByText, getByLabelText, getByText, findByRole, findByText } = render(<PaymentScreen />);

    await waitFor(() => expect(getAllByText('$1,248.50').length).toBeGreaterThan(0));
    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));
    fireEvent.press(await findByRole('button', { name: 'Confirm Payment' }));

    expect(
      await findByText('Something went wrong while processing your payment. Please try again later.')
    ).toBeTruthy();
    fireEvent.changeText(getByLabelText('First Name'), 'Jane');
    fireEvent.changeText(getByLabelText('Last Name'), 'Builder');
    fireEvent.changeText(getByLabelText('Address'), '123 Main Street');
    fireEvent.changeText(getByLabelText('Address 2 (Optional)'), 'Suite 100');
    fireEvent.changeText(getByLabelText('City'), 'Los Angeles');
    fireEvent.press(getByLabelText('State'));
    fireEvent.press(getByLabelText('California (CA)'));
    fireEvent.changeText(getByLabelText('ZIP Code'), '90001');
    fireEvent.changeText(getByLabelText('Phone (Optional)'), '5551112222');
    fireEvent.changeText(getByLabelText('Card Number'), '4111111111111111');
    fireEvent.changeText(getByLabelText('Expiration (MM/YY)'), '1230');
    fireEvent.changeText(getByLabelText('Security Code'), '123');
    fireEvent.press(getByText('Review Payment'));
    fireEvent.press(await findByRole('button', { name: 'Confirm Payment' }));

    expect(await findByText('input1-receipt-2')).toBeTruthy();
    expect(mockSubmitPayment).toHaveBeenCalledTimes(2);
    expect(mockSubmitPayment.mock.calls[0][3]).toBe(
      '740f67f1-71bf-44b6-ae37-f42e728998d7'
    );
    expect(mockSubmitPayment.mock.calls[1][3]).toBe(
      '740f67f1-71bf-44b6-ae37-f42e728998d7'
    );
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });

  it('shows a paid-up state when PBIA returns no payable records', () => {
    mockUsePayments.mockReturnValue({
      paymentRecords: [],
      payableRecords: [],
      isLoadingPayments: false,
      paymentsError: null,
      refreshPaymentEligibility: mockRefreshPaymentEligibility,
    });

    const { getByText } = render(<PaymentScreen />);

    expect(getByText('No payment currently due')).toBeTruthy();
    fireEvent.press(getByText('Back to account'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  describe('premium payment choices', () => {
    function useRecord(record: PaymentEligibility = buildFinancedPaymentEligibility()) {
      mockUsePayments.mockReturnValue({
        paymentRecords: [record], payableRecords: [record], isLoadingPayments: false,
        paymentsError: null, refreshPaymentEligibility: mockRefreshPaymentEligibility,
      });
      mockGetPaymentEligibility.mockResolvedValue(record);
      return record;
    }

    function fillInstrument(view: ReturnType<typeof render>, method: 'CARD' | 'ACH') {
      if (method === 'ACH') {
        fireEvent.press(view.getByText('Bank Account (ACH)'));
        fireEvent.changeText(view.getByLabelText('Bank Name'), 'Example Bank');
        fireEvent.changeText(view.getByLabelText('Routing Number'), '021000021');
        fireEvent.changeText(view.getByLabelText('Bank Account Number'), '123456789');
      } else {
        fireEvent.changeText(view.getByLabelText('Card Number'), '4111111111111111');
        fireEvent.changeText(view.getByLabelText('Expiration (MM/YY)'), '1230');
        fireEvent.changeText(view.getByLabelText('Security Code'), '123');
      }
    }

    it.each(['CARD', 'ACH'] as const)('collects only the down payment via %s using saved monthly pricing', async (method) => {
      const record = useRecord();
      mockSubmitPayment.mockResolvedValue({
        id: 'payment-financed', demandId: 'demand-1', paymentOptionId: null, termYears: null,
        status: 'SUCCEEDED', amount: 100, purpose: 'DOWN_PAYMENT', receiptId: 'financed-receipt',
        currency: 'USD', completedAt: '2026-09-18T18:01:00.000Z', addOnConvenienceFee: 0,
        premiumPaymentOption: 'FINANCED_PREMIUM', convenienceFee: method === 'CARD' ? 3.5 : 3,
        totalCharged: method === 'CARD' ? 103.5 : 103,
      });
      const view = render(<PaymentScreen />);
      expect(view.getByRole('radio', { name: 'Full Premium' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: true }));
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      expect(view.getByText('Then 10 monthly payments of $45.00')).toBeTruthy();
      fillInstrument(view, method);
      fireEvent.press(view.getByText('Review Payment'));
      const confirm = await view.findByRole('button', { name: 'Confirm Payment' });
      expect(view.getAllByText(method === 'CARD' ? '$103.50' : '$103.00').length).toBeGreaterThan(0);
      fireEvent.press(confirm);
      expect(await view.findByText('Down payment received')).toBeTruthy();
      expect(mockSubmitPayment).toHaveBeenCalledTimes(1);
      const request = mockSubmitPayment.mock.calls[0][4];
      expect(request).toMatchObject({ premiumPaymentOption: 'FINANCED_PREMIUM', pricingVersion: record.pricingVersion, paymentMethod: method });
      expect(request).not.toHaveProperty('amount');
      expect(request).not.toHaveProperty('financing');
      expect(request).not.toHaveProperty('paymentOptionId');
    });

    it.each(['CARD', 'ACH'] as const)('defaults to full premium and submits the version via %s', async (method) => {
      const record = useRecord();
      const view = render(<PaymentScreen />);
      fillInstrument(view, method);
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await waitFor(() => expect(mockSubmitPayment).toHaveBeenCalled());
      expect(mockSubmitPayment.mock.calls[0][4]).toMatchObject({ premiumPaymentOption: 'FULL_PREMIUM', pricingVersion: record.pricingVersion });
    });

    it.each(['version', 'monthly amount', 'removed financing', 'fee'])('requires new review when %s changes before confirmation', async (change) => {
      const record = useRecord();
      const view = render(<PaymentScreen />);
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      const confirm = await view.findByRole('button', { name: 'Confirm Payment' });
      mockGetPaymentEligibility.mockResolvedValue({
        ...record,
        ...(change === 'version' ? { pricingVersion: '2026-09-18T19:00:00.000Z' } : {}),
        ...(change === 'monthly amount' ? { financing: { ...record.financing, paymentAmount: 46 } } : {}),
        ...(change === 'removed financing' ? { financing: null } : {}),
        ...(change === 'fee' ? { financedCardConvenienceFee: 4, financedCardTotalAmount: 104 } : {}),
      });
      fireEvent.press(confirm);
      await view.findByText(/The payment request changed/);
      expect(mockSubmitPayment).not.toHaveBeenCalled();
      expect(view.queryByRole('button', { name: 'Confirm Payment' })).toBeNull();
    });

    it('keeps an uncertain network attempt blocked when switching premium choices', async () => {
      useRecord();
      mockSubmitPayment.mockRejectedValue(new TypeError('Network request failed'));
      const view = render(<PaymentScreen />);
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await view.findByText('We could not confirm your payment. Please contact PBIA before trying again.');
      fireEvent.press(view.getByRole('radio', { name: 'Full Premium' }));
      expect(view.getByRole('button', { name: 'Review Payment' })).toBeDisabled();
      expect(mockSubmitPayment).toHaveBeenCalledTimes(1);
    });
    it.each([1, 2, 3, 4, 5])('uses financing for the selected %s-year term and resets on term change', async (termYears) => {
      const record = buildFinancedPaymentEligibility();
      const amount = termYears * 500;
      const selected = buildPaymentTermOption({
        id: `term-${termYears}`, termYears, label: `${termYears} years`, amount,
        financing: { ...record.financing, fullPremium: amount, downPayment: termYears * 100 },
        cardConvenienceFee: 3, cardTotalAmount: amount + 3,
        achConvenienceFee: 3, achTotalAmount: amount + 3,
        financedCardConvenienceFee: 3, financedCardTotalAmount: termYears * 100 + 3,
        financedAchConvenienceFee: 3, financedAchTotalAmount: termYears * 100 + 3,
      });
      const other = buildPaymentTermOption({ id: 'other', label: 'Other term' });
      useRecord({ ...record, paymentMode: 'TERM_OPTIONS', termOptions: [selected, other] });
      const view = render(<PaymentScreen />);
      expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
      fireEvent.press(view.getByLabelText(`${termYears} years, $${amount.toLocaleString('en-US')}.00`));
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fireEvent.press(view.getByLabelText('Other term, $139.00'));
      expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
      expect(view.queryByText('Premium Payment')).toBeNull();
      expect(within(view.getByTestId('payment-summary-card')).getByText('$139.00')).toBeTruthy();
      fireEvent.press(view.getByLabelText(`${termYears} years, $${amount.toLocaleString('en-US')}.00`));
      expect(view.getByRole('radio', { name: 'Full Premium' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: true }));
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await waitFor(() => expect(mockSubmitPayment).toHaveBeenCalled());
      expect(mockSubmitPayment.mock.calls[0][4]).toMatchObject({ paymentOptionId: selected.id, premiumPaymentOption: 'FINANCED_PREMIUM' });
    });

    it.each(['GENERAL_LIABILITY', 'WORKERS_COMP', 'COMMERCIAL_AUTO', 'CONTRACTOR_LICENSE_BOND'])('offers financing for %s', (lineOfBusiness) => {
      useRecord({ ...buildFinancedPaymentEligibility(), lineOfBusiness });
      const view = render(<PaymentScreen />);
      expect(view.getByRole('radio', { name: 'Financed Premium' })).toBeTruthy();
    });

    it.each(['legacy', 'no financing', 'fee', 'audit'] as const)('preserves the full-payment flow for %s', async (scenario) => {
      const record: PaymentEligibility = {
        ...buildFinancedPaymentEligibility(),
        ...(scenario === 'legacy' ? { pricingVersion: undefined } : {}),
        ...(scenario === 'no financing' ? { financing: null } : {}),
        ...(scenario === 'fee' ? { purpose: 'POLICY_FEE' as const } : {}),
        ...(scenario === 'audit' ? { purpose: 'PREMIUM_AUDIT' as const } : {}),
      };
      useRecord(record);
      const view = render(<PaymentScreen />);
      expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await waitFor(() => expect(mockSubmitPayment).toHaveBeenCalled());
      const request = mockSubmitPayment.mock.calls[0][4];
      if (scenario === 'no financing') expect(request.premiumPaymentOption).toBe('FULL_PREMIUM');
      else {
        expect(request).not.toHaveProperty('premiumPaymentOption');
        expect(request).toMatchObject({ amount: 500, purpose: record.purpose });
      }
    });

    it('does not confirm financing without an applicable fee preview', async () => {
      useRecord({ ...buildFinancedPaymentEligibility(), financedCardConvenienceFee: null, financedCardTotalAmount: null });
      const view = render(<PaymentScreen />);
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      expect(await view.findByText('Card payments are unavailable until the Input1 convenience fee is confirmed.')).toBeTruthy();
      expect(mockSubmitPayment).not.toHaveBeenCalled();
    });

    it.each([400, 409])('reloads after a %s without silently submitting full premium', async (status) => {
      const { PaymentApiError } = require('@/services/payment-api');
      useRecord();
      mockSubmitPayment.mockRejectedValue(new PaymentApiError(status, 'Pricing changed'));
      const view = render(<PaymentScreen />);
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      const confirm = await view.findByRole('button', { name: 'Confirm Payment' });
      mockRefreshPaymentEligibility.mockClear();
      fireEvent.press(confirm);
      await waitFor(() => expect(view.queryByRole('button', { name: 'Confirm Payment' })).toBeNull());
      expect(mockRefreshPaymentEligibility).toHaveBeenCalled();
      expect(mockSubmitPayment).toHaveBeenCalledTimes(1);
      expect(mockSubmitPayment.mock.calls[0][4].premiumPaymentOption).toBe('FINANCED_PREMIUM');
    });

    it('submits once when confirm is tapped rapidly', async () => {
      useRecord();
      const view = render(<PaymentScreen />);
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      const confirm = await view.findByRole('button', { name: 'Confirm Payment' });
      fireEvent.press(confirm);
      fireEvent.press(confirm);
      await view.findByText('Payment successful');
      expect(mockSubmitPayment).toHaveBeenCalledTimes(1);
    });

    it('requires a fresh review after changing choice or instrument', async () => {
      useRecord();
      const view = render(<PaymentScreen />);
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      await view.findByRole('button', { name: 'Confirm Payment' });
      fireEvent.press(view.getByText('Edit Payment'));
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'ACH');
      expect(view.queryByRole('button', { name: 'Confirm Payment' })).toBeNull();
      expect(view.getAllByText('$103.00').length).toBeGreaterThan(0);
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await waitFor(() => expect(mockSubmitPayment).toHaveBeenCalled());
      expect(mockSubmitPayment.mock.calls[0][4]).toMatchObject({ premiumPaymentOption: 'FINANCED_PREMIUM', paymentMethod: 'ACH' });
    });

    it('resets to full premium after a reload and invalidates the prior review', async () => {
      const record = useRecord();
      const view = render(<PaymentScreen />);
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      await view.findByRole('button', { name: 'Confirm Payment' });
      useRecord({ ...record, pricingVersion: '2026-09-18T20:00:00.000Z' });
      view.rerender(<PaymentScreen />);
      expect(view.queryByRole('button', { name: 'Confirm Payment' })).toBeNull();
      expect(view.getByRole('radio', { name: 'Full Premium' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: true }));
      expect(mockSubmitPayment).not.toHaveBeenCalled();
    });

    it('keeps malformed success blocked even if eligibility would still return a demand', async () => {
      const { PaymentApiError } = require('@/services/payment-api');
      useRecord();
      mockSubmitPayment.mockRejectedValue(Object.assign(new PaymentApiError(502, 'Unknown receipt'), { outcomeUncertain: true }));
      const view = render(<PaymentScreen />);
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await view.findByText('We could not confirm your payment. Please contact PBIA before trying again.');
      expect(mockGetPaymentEligibility).toHaveBeenCalledTimes(2);
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      expect(view.getByRole('button', { name: 'Review Payment' })).toBeDisabled();
    });

    it('shows actual financed receipt fees and never substitutes an estimated total', async () => {
      useRecord();
      mockSubmitPayment.mockResolvedValue({
        id: 'paid', demandId: 'demand-1', premiumPaymentOption: 'FINANCED_PREMIUM',
        paymentOptionId: null, termYears: null, status: 'SUCCEEDED', purpose: 'DOWN_PAYMENT',
        amount: 100, convenienceFee: 4, addOnConvenienceFee: 1, totalCharged: null,
        currency: 'USD', receiptId: 'actual-receipt', completedAt: null,
      });
      const view = render(<PaymentScreen />);
      fireEvent.press(view.getByRole('radio', { name: 'Financed Premium' }));
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await view.findByText('Down payment received');
      expect(view.getByText('$4.00')).toBeTruthy();
      expect(view.getByText('$1.00')).toBeTruthy();
      expect(view.getByText('actual-receipt')).toBeTruthy();
      expect(view.queryByText('Total charged')).toBeNull();
      expect(view.queryByText('$103.50')).toBeNull();
    });

    it('does not carry a receipt into another customer account', async () => {
      useRecord();
      const view = render(<PaymentScreen />);
      fillInstrument(view, 'CARD');
      fireEvent.press(view.getByText('Review Payment'));
      fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
      await view.findByText('Payment successful');
      mockUseAuth.mockReturnValue({ ...mockUseAuth(), customer: buildCustomer({ accountId: 'account-2' }) });
      useRecord({ ...buildFinancedPaymentEligibility(), accountId: 'account-2', demandId: 'demand-2' });
      view.rerender(<PaymentScreen />);
      expect(view.queryByText('Payment successful')).toBeNull();
      expect(view.getByLabelText('Card Number')).toHaveProp('value', '');
    });

    describe('agent premium offers', () => {
      it.each([
        ['FULL_PREMIUM_ONLY', '$500.00'],
        ['BOTH', '$500.00'],
        ['FINANCED_PREMIUM_ONLY', '$100.00'],
      ] as const)('shows a choice only when needed for %s on opening and reload', (offer, expectedAmount) => {
        const record = { ...buildFinancedPaymentEligibility(), premiumPaymentOffer: offer };
        useRecord(record);
        const view = render(<PaymentScreen />);
        const assertSelection = () => {
          expect(within(view.getByTestId('payment-summary-card')).getByText(expectedAmount)).toBeTruthy();
          if (offer === 'BOTH') {
            expect(view.getByText('Premium Payment')).toBeTruthy();
            expect(view.getByRole('radio', { name: 'Full Premium' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: true }));
            expect(view.getByRole('radio', { name: 'Financed Premium' })).toBeTruthy();
          } else {
            expect(view.queryByText('Premium Payment')).toBeNull();
            expect(view.queryByRole('radio', { name: 'Full Premium' })).toBeNull();
            expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
          }
        };
        assertSelection();
        useRecord({ ...record });
        view.rerender(<PaymentScreen />);
        assertSelection();
      });

      it.each(['CARD', 'ACH'] as const)('submits financed-only through %s without offering full payment', async (method) => {
        const record = { ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' as const };
        useRecord(record);
        const view = render(<PaymentScreen />);
        expect(view.queryByRole('radio', { name: 'Full Premium' })).toBeNull();
        expect(within(view.getByTestId('payment-summary-card')).getByText('$100.00')).toBeTruthy();
        expect(view.getByText('$100.00 down today, then 10 monthly payments of $45.00. The finance company handles the remaining payments.')).toBeTruthy();
        expect(view.queryByText('Premium Payment')).toBeNull();
        fillInstrument(view, method);
        expect(view.getByLabelText('State')).toHaveProp('accessibilityValue', { text: 'California' });
        fireEvent.press(view.getByLabelText('State'));
        fireEvent.press(view.getByLabelText('Texas (TX)'));
        fireEvent.press(view.getByText('Review Payment'));
        fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
        await waitFor(() => expect(mockSubmitPayment).toHaveBeenCalledTimes(1));
        const request = mockSubmitPayment.mock.calls[0][4];
        expect(request).toMatchObject({ premiumPaymentOption: 'FINANCED_PREMIUM', pricingVersion: record.pricingVersion });
        expect(request[method === 'CARD' ? 'card' : 'ach'].region).toBe('Texas');
        expect(request).not.toHaveProperty('premiumPaymentOffer');
      });

      it.each(['terms', 'version'] as const)('blocks financed-only when %s are missing instead of defaulting to full', (missing) => {
        const record = {
          ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' as const,
          ...(missing === 'terms' ? { financing: null } : { pricingVersion: undefined }),
        };
        useRecord(record);
        const view = render(<PaymentScreen />);
        expect(view.queryByRole('radio', { name: 'Full Premium' })).toBeNull();
        expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
        expect(view.getByText('Premium pricing is unavailable. Refresh payment details or contact your agent.')).toBeTruthy();
        expect(view.getByRole('button', { name: 'Review Payment' })).toBeDisabled();
        expect(within(view.getByTestId('payment-summary-card')).queryByText('$500.00')).toBeNull();
        expect(mockSubmitPayment).not.toHaveBeenCalled();
      });

      it('keeps full payment when BOTH has no financing', () => {
        const record = {
          ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'BOTH' as const, financing: null,
          financedCardConvenienceFee: null, financedCardTotalAmount: null,
          financedAchConvenienceFee: null, financedAchTotalAmount: null,
        };
        useRecord(record);
        const view = render(<PaymentScreen />);
        expect(view.queryByText('Premium Payment')).toBeNull();
        expect(within(view.getByTestId('payment-summary-card')).getByText('$500.00')).toBeTruthy();
        expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
      });

      it('requires a fresh review when only the offer changes', async () => {
        const record = { ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'BOTH' as const };
        useRecord(record);
        const view = render(<PaymentScreen />);
        fillInstrument(view, 'CARD');
        fireEvent.press(view.getByText('Review Payment'));
        const confirm = await view.findByRole('button', { name: 'Confirm Payment' });
        mockGetPaymentEligibility.mockResolvedValue({ ...record, premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' });
        fireEvent.press(confirm);
        await view.findByText(/The payment request changed/);
        expect(mockSubmitPayment).not.toHaveBeenCalled();
      });

      it.each([1, 2, 3, 4, 5])('defaults to financing on a financed-only %s-year term', async (termYears) => {
        const base = buildFinancedPaymentEligibility();
        const terms = [1, 2, 3, 4, 5].map((years) => buildPaymentTermOption({
          id: `term-${years}`, termYears: years, label: `${years} years`, amount: years * 500,
          financing: { ...base.financing, fullPremium: years * 500, downPayment: years * 100 },
          cardConvenienceFee: 3, cardTotalAmount: years * 500 + 3,
          achConvenienceFee: 3, achTotalAmount: years * 500 + 3,
          financedCardConvenienceFee: 3, financedCardTotalAmount: years * 100 + 3,
          financedAchConvenienceFee: 3, financedAchTotalAmount: years * 100 + 3,
        }));
        const record = { ...base, paymentMode: 'TERM_OPTIONS' as const, premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' as const, termOptions: terms };
        useRecord(record);
        const view = render(<PaymentScreen />);
        fireEvent.press(view.getByLabelText(`${termYears} years, $${(termYears * 500).toLocaleString('en-US')}.00`));
        expect(view.queryByRole('radio', { name: 'Full Premium' })).toBeNull();
        expect(view.queryByText('Premium Payment')).toBeNull();
        expect(within(view.getByTestId('payment-summary-card')).getByText(`$${termYears * 100}.00`)).toBeTruthy();
        fillInstrument(view, 'CARD');
        fireEvent.press(view.getByText('Review Payment'));
        fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
        await waitFor(() => expect(mockSubmitPayment).toHaveBeenCalledTimes(1));
        expect(mockSubmitPayment.mock.calls[0][4]).toMatchObject({ paymentOptionId: `term-${termYears}`, premiumPaymentOption: 'FINANCED_PREMIUM' });
      });
      it('does not borrow root financing for an unavailable financed-only term', () => {
        const base = buildFinancedPaymentEligibility();
        useRecord({
          ...base, premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY', paymentMode: 'TERM_OPTIONS',
          termOptions: [buildPaymentTermOption(), buildPaymentTermOption({
            id: 'term-2', termYears: 2, label: '2 years', amount: 500, financing: base.financing,
          })],
        });
        const view = render(<PaymentScreen />);
        fireEvent.press(view.getByLabelText('2 years, $500.00'));
        expect(view.queryByText('Premium Payment')).toBeNull();
        expect(within(view.getByTestId('payment-summary-card')).getByText('$100.00')).toBeTruthy();
        fireEvent.press(view.getByLabelText('1 year, $139.00'));
        expect(view.queryByRole('radio', { name: 'Full Premium' })).toBeNull();
        expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
        expect(view.getByRole('button', { name: 'Review Payment' })).toBeDisabled();
        expect(view.getByText('Premium pricing is unavailable. Refresh payment details or contact your agent.')).toBeTruthy();
      });

      it('does not unblock an uncertain financed-only charge when the offer changes to BOTH', async () => {
        const record = { ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' as const };
        useRecord(record);
        mockSubmitPayment.mockRejectedValue(new TypeError('Network failed'));
        const view = render(<PaymentScreen />);
        fillInstrument(view, 'CARD');
        fireEvent.press(view.getByText('Review Payment'));
        fireEvent.press(await view.findByRole('button', { name: 'Confirm Payment' }));
        await view.findByText('We could not confirm your payment. Please contact PBIA before trying again.');
        useRecord({ ...record, premiumPaymentOffer: 'BOTH' });
        view.rerender(<PaymentScreen />);
        expect(view.getByRole('radio', { name: 'Full Premium' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: true }));
        expect(view.getByRole('button', { name: 'Review Payment' })).toBeDisabled();
        expect(mockSubmitPayment).toHaveBeenCalledTimes(1);
      });

      it.each(['', 'Unknown State'])('requires correction of billing state %s', (region) => {
        useRecord({ ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' });
        mockUseAuth.mockReturnValue({
          ...mockUseAuth(), customer: { ...mockUseAuth().customer, stateNameOrAbbreviation: region },
        });
        const view = render(<PaymentScreen />);
        fillInstrument(view, 'CARD');
        expect(view.getByLabelText('State')).toHaveProp('accessibilityValue', { text: 'Select a state' });
        fireEvent.press(view.getByText('Review Payment'));
        expect(view.getByText('Select a valid US state.')).toBeTruthy();
        expect(mockSubmitPayment).not.toHaveBeenCalled();
      });

      it.each(['CARD', 'ACH'] as const)('submits full-only via %s while hiding saved financing', async (method) => {
        useRecord({ ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'FULL_PREMIUM_ONLY' });
        const view = render(<PaymentScreen />);
        expect(view.queryByRole('radio', { name: 'Financed Premium' })).toBeNull();
        expect(view.queryByText('Then 10 monthly payments of $45.00')).toBeNull();
        fillInstrument(view, method);
        fireEvent.press(view.getByText('Review Payment'));
        const confirm = await view.findByRole('button', { name: 'Confirm Payment' });
        expect(view.getAllByText(method === 'CARD' ? '$517.50' : '$503.00').length).toBeGreaterThan(0);
        fireEvent.press(confirm);
        await waitFor(() => expect(mockSubmitPayment).toHaveBeenCalledTimes(1));
        expect(mockSubmitPayment.mock.calls[0][4]).toMatchObject({ premiumPaymentOption: 'FULL_PREMIUM' });
      });

      it('keeps a historical null offer as BOTH', () => {
        useRecord({ ...buildFinancedPaymentEligibility(), premiumPaymentOffer: null });
        const view = render(<PaymentScreen />);
        expect(view.getByRole('radio', { name: 'Full Premium' })).toBeTruthy();
        expect(view.getByRole('radio', { name: 'Financed Premium' })).toBeTruthy();
      });

      it('allows legacy full payment to be reviewed again after a temporary eligibility failure', async () => {
        useRecord({ ...buildFinancedPaymentEligibility(), pricingVersion: undefined });
        mockGetPaymentEligibility.mockRejectedValueOnce(new TypeError('Network failed'));
        const view = render(<PaymentScreen />);
        fillInstrument(view, 'CARD');
        fireEvent.press(view.getByText('Review Payment'));
        await view.findByText('Something went wrong while processing your payment. Please try again later.');
        expect(view.getByRole('button', { name: 'Review Payment' })).not.toBeDisabled();
        expect(mockSubmitPayment).not.toHaveBeenCalled();
      });

    });

  });

});
