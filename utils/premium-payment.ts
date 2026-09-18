import type { PaymentEligibility, PaymentTermOption, PremiumPaymentOffer, PremiumPaymentOption, PremiumPaymentTerms, PremiumPricingFields } from '@/types/payment';

export function isPremiumPaymentOffer(value: unknown): value is PremiumPaymentOffer {
  return value === 'FULL_PREMIUM_ONLY' || value === 'FINANCED_PREMIUM_ONLY' || value === 'BOTH';
}

export function isPremiumPaymentOption(value: unknown): value is PremiumPaymentOption {
  return value === 'FULL_PREMIUM' || value === 'FINANCED_PREMIUM';
}

export function isPricingVersion(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

export function isPaymentMoney(value: unknown, allowZero = false): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0) && value <= 999_999_999_999.99 &&
    Math.round(value * 100) / 100 === value;
}

export function isPremiumPaymentTerms(value: unknown, fullAmount: number): value is PremiumPaymentTerms {
  if (!value || typeof value !== 'object') return false;
  const terms = value as Partial<PremiumPaymentTerms>;
  return isPaymentMoney(terms.fullPremium) && isPaymentMoney(fullAmount) &&
    Math.round(terms.fullPremium * 100) === Math.round(fullAmount * 100) &&
    isPaymentMoney(terms.downPayment) && terms.downPayment < terms.fullPremium &&
    isPaymentMoney(terms.paymentAmount) && typeof terms.paymentCount === 'number' &&
    Number.isInteger(terms.paymentCount) && terms.paymentCount >= 1 && terms.paymentCount <= 120;
}

function isPremiumFeePreview(base: number | undefined, fee: unknown, total: unknown) {
  if (fee == null && total == null) return true;
  return base !== undefined && isPaymentMoney(base) && isPaymentMoney(fee, true) && isPaymentMoney(total) &&
    Math.round(total * 100) === Math.round(base * 100) + Math.round(fee * 100);
}

export function hasValidPremiumPricing(value: PremiumPricingFields, fullAmount: number) {
  return (value.financing == null || isPremiumPaymentTerms(value.financing, fullAmount)) &&
    isPremiumFeePreview(value.financing?.downPayment, value.financedCardConvenienceFee, value.financedCardTotalAmount) &&
    isPremiumFeePreview(value.financing?.downPayment, value.financedAchConvenienceFee, value.financedAchTotalAmount);
}

export function hasValidFullPremiumFees(
  value: Partial<Pick<PaymentTermOption, 'cardConvenienceFee' | 'cardTotalAmount' | 'achConvenienceFee' | 'achTotalAmount'>>,
  fullAmount: number
) {
  return isPaymentMoney(fullAmount) &&
    isPremiumFeePreview(fullAmount, value.cardConvenienceFee, value.cardTotalAmount) &&
    isPremiumFeePreview(fullAmount, value.achConvenienceFee, value.achTotalAmount);
}

export function isPremiumDemand(record: PaymentEligibility) {
  return record.purpose === 'PREMIUM' && !record.paymentPlanId &&
    (record.paymentMode === 'FIXED' || record.paymentMode === 'TERM_OPTIONS');
}

export function supportsPremiumChoice(record: PaymentEligibility) {
  return isPremiumDemand(record) && isPricingVersion(record.pricingVersion);
}

export function isFinancedOnlyDemand(record: PaymentEligibility) {
  return isPremiumDemand(record) && record.premiumPaymentOffer === 'FINANCED_PREMIUM_ONLY';
}

export function availablePremiumPaymentOptions(
  record: PaymentEligibility,
  paymentOptionId?: string
): PremiumPaymentOption[] {
  if (!isPremiumDemand(record)) return ['FULL_PREMIUM'];
  // Historical offers retain BOTH semantics; the new-record default is server-owned.
  const offer = record.premiumPaymentOffer ?? 'BOTH';
  if (!isPremiumPaymentOffer(offer)) return [];
  const source = record.paymentMode === 'TERM_OPTIONS'
    ? record.termOptions.find((option) => option.id === paymentOptionId)
    : record;
  if (!source) return [];
  const fullAmount = 'amount' in source ? source.amount : source.amountDue;
  if (!isPaymentMoney(fullAmount)) return [];
  const validFinancing = isPremiumPaymentTerms(source.financing, fullAmount);
  if (source.financing != null && !validFinancing) return [];
  const options: PremiumPaymentOption[] = [];
  if (offer !== 'FINANCED_PREMIUM_ONLY') options.push('FULL_PREMIUM');
  if (offer !== 'FULL_PREMIUM_ONLY' && validFinancing && supportsPremiumChoice(record)) {
    options.push('FINANCED_PREMIUM');
  }
  return options;
}

/** Initial payable amount, excluding processing fees and future finance-company payments. */
export function paymentDemandAmount(record: PaymentEligibility): number | null {
  if (!isPremiumDemand(record)) {
    return record.paymentMode === 'TERM_OPTIONS'
      ? (record.termOptions.length ? Math.min(...record.termOptions.map((option) => option.amount)) : null)
      : record.amountDue;
  }
  const sources = record.paymentMode === 'TERM_OPTIONS' ? record.termOptions : [record];
  const amounts = sources.flatMap((source) => {
    const choice = availablePremiumPaymentOptions(record, 'id' in source ? source.id : undefined)[0];
    if (!choice) return [];
    if (choice === 'FINANCED_PREMIUM') return source.financing ? [source.financing.downPayment] : [];
    return ['amount' in source ? source.amount : source.amountDue];
  });
  return amounts.length ? Math.min(...amounts) : null;
}

// Only pricing goes into this snapshot; never payer or instrument details.
export function premiumPricingSnapshot(value: PremiumPricingFields) {
  const terms = value.financing;
  return JSON.stringify([
    terms ? [terms.fullPremium, terms.downPayment, terms.paymentCount, terms.paymentAmount] : null,
    value.financedCardConvenienceFee ?? null, value.financedCardTotalAmount ?? null,
    value.financedAchConvenienceFee ?? null, value.financedAchTotalAmount ?? null,
  ]);
}
