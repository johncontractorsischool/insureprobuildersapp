import { buildPaymentEligibility } from '@/tests/factories';
import {
  buildAccountPaymentSummary,
  formatLineOfBusiness,
  isValidAbaRoutingNumber,
  normalizeUsStateName,
  parsePaymentAmount,
} from '@/utils/account-payment';

describe('account payment utilities', () => {
  it('formats customer-facing policy type labels with a safe fallback', () => {
    expect(formatLineOfBusiness('CONTRACTOR_LICENSE_BOND')).toBe('Contractors License Bond');
    expect(formatLineOfBusiness('WORKERS_COMP')).toBe('Workers Compensation');
    expect(formatLineOfBusiness('GENERAL_LIABILITY')).toBe('General Liability');
    expect(formatLineOfBusiness('COMMERCIAL_AUTO')).toBe('Commercial Auto');
    expect(formatLineOfBusiness('')).toBe('Insurance payment');
  });

  it('combines only PBIA records explicitly eligible for payment', () => {
    const summary = buildAccountPaymentSummary([
      buildPaymentEligibility({
        demandId: 'demand-gl',
        recordId: 'gl-policy',
        lineOfBusiness: 'GENERAL_LIABILITY',
        amountDue: 980,
      }),
      buildPaymentEligibility({
        demandId: 'demand-wc',
        recordId: 'wc-policy',
        lineOfBusiness: 'WORKERS_COMP',
        amountDue: 218.5,
      }),
    ]);

    expect(summary).toEqual({
      totalOutstanding: 1198.5,
      lineItems: [
        { id: 'demand-gl', label: 'General Liability', amount: 980 },
        { id: 'demand-wc', label: 'Workers Compensation', amount: 218.5 },
      ],
    });
  });

  it('validates money precision, state names, and ABA routing checksums', () => {
    expect(parsePaymentAmount('750.00')).toBe(750);
    expect(parsePaymentAmount('750.001')).toBeNull();
    expect(parsePaymentAmount('0')).toBeNull();
    expect(normalizeUsStateName('CA')).toBe('California');
    expect(isValidAbaRoutingNumber('021000021')).toBe(true);
    expect(isValidAbaRoutingNumber('021000022')).toBe(false);
  });
});
