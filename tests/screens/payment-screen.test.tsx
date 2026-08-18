import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  buildCustomer,
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
          creditCardNumber: '4111111111111111',
        }),
      })
    );
    expect(mockRefreshPaymentEligibility).toHaveBeenCalled();
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

    const { findByRole, findByText, getByLabelText, getByText } = render(<PaymentScreen />);

    expect(await findByRole('button', { name: 'Review Payment' })).toBeDisabled();
    fireEvent.press(getByLabelText('3 years, $330.00'));
    expect(getByText('Card total $339.90 • ACH total $333.00')).toBeTruthy();
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
    fireEvent.changeText(getByLabelText('State'), 'California');
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

});
