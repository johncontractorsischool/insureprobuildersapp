import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PaymentDueCard } from '@/components/payment-due-card';
import { buildFinancedPaymentEligibility, buildPaymentTermOption } from '@/tests/factories';

describe('premium payment due card', () => {
  it('shows the down payment for financed-only and still opens the existing checkout', () => {
    const record = { ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' as const };
    const onMakePayment = jest.fn();
    const view = render(<PaymentDueCard record={record} onMakePayment={onMakePayment} />);
    expect(view.getByText('$100.00')).toBeTruthy();
    expect(view.queryByText('$500.00')).toBeNull();
    expect(view.getByText('Down Payment Due')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Pay Now' }));
    expect(onMakePayment).toHaveBeenCalledTimes(1);
  });

  it('uses the available term down payments for the starting amount', () => {
    const base = buildFinancedPaymentEligibility();
    const record = {
      ...base, premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' as const, paymentMode: 'TERM_OPTIONS' as const,
      termOptions: [
        buildPaymentTermOption(),
        buildPaymentTermOption({ id: 'term-2', termYears: 2, amount: 500, financing: base.financing }),
      ],
    };
    const view = render(<PaymentDueCard record={record} onMakePayment={jest.fn()} />);
    expect(view.getByText('From $100.00')).toBeTruthy();
    expect(view.queryByText('From $139.00')).toBeNull();
  });

  it('shows unavailable financed-only pricing without advertising a full charge', () => {
    const record = {
      ...buildFinancedPaymentEligibility(), premiumPaymentOffer: 'FINANCED_PREMIUM_ONLY' as const,
      pricingVersion: undefined,
    };
    const view = render(<PaymentDueCard record={record} onMakePayment={jest.fn()} />);
    expect(view.getByText('Pricing unavailable')).toBeTruthy();
    expect(view.queryByText('$500.00')).toBeNull();
    expect(view.getByRole('button', { name: 'Review Details' })).toBeTruthy();
  });
});
