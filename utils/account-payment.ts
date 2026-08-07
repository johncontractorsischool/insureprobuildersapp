import type { PaymentEligibility, PaymentPurpose } from '@/types/payment';

export type AccountPaymentLineItem = {
  id: string;
  label: string;
  amount: number;
};

export type AccountPaymentSummary = {
  totalOutstanding: number;
  lineItems: AccountPaymentLineItem[];
};

export const PAYMENT_PURPOSE_OPTIONS: Array<{ value: PaymentPurpose; label: string }> = [
  { value: 'PREMIUM', label: 'Full Premium' },
  { value: 'DOWN_PAYMENT', label: 'Down Payment' },
  { value: 'INSTALLMENT', label: 'Installment' },
  { value: 'POLICY_FEE', label: 'Policy Fee' },
  { value: 'OTHER', label: 'Other' },
];

export function getPaymentPurposeLabel(purpose: PaymentPurpose) {
  return PAYMENT_PURPOSE_OPTIONS.find((option) => option.value === purpose)?.label ?? 'Payment';
}

const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

const LINE_OF_BUSINESS_LABELS: Record<string, string> = {
  CONTRACTOR_LICENSE_BOND: 'Contractors License Bond',
  WORKERS_COMP: 'Workers Compensation',
  WORKERS_COMPENSATION: 'Workers Compensation',
  GENERAL_LIABILITY: 'General Liability',
  COMMERCIAL_AUTO: 'Commercial Auto',
};

export function formatLineOfBusiness(value: string) {
  const normalized = value.trim();
  if (!normalized) return 'Insurance payment';
  if (LINE_OF_BUSINESS_LABELS[normalized]) return LINE_OF_BUSINESS_LABELS[normalized];

  return normalized
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildPaymentRecordLabel(record: PaymentEligibility) {
  const businessLine = record.lineOfBusiness.trim()
    ? formatLineOfBusiness(record.lineOfBusiness)
    : null;
  const number = record.policyNumber?.trim();
  if (businessLine && number) return `${businessLine} • ${number}`;
  return businessLine ?? number ?? `${record.recordType === 'QUOTE' ? 'Quote' : 'Policy'} payment`;
}

export function buildAccountPaymentSummary(
  paymentRecords: PaymentEligibility[]
): AccountPaymentSummary | null {
  const payableRecords = paymentRecords.filter(
    (record) => record.paymentState === 'DUE' && record.paymentNeeded && record.amountDue > 0
  );
  if (payableRecords.length === 0) return null;

  const lineItems = payableRecords.map((record) => ({
    id: record.demandId,
    label: record.lineOfBusiness.trim()
      ? formatLineOfBusiness(record.lineOfBusiness)
      : buildPaymentRecordLabel(record),
    amount: record.amountDue,
  }));

  return {
    totalOutstanding:
      Math.round(lineItems.reduce((total, lineItem) => total + lineItem.amount, 0) * 100) / 100,
    lineItems,
  };
}

export function parsePaymentAmount(value: string) {
  const normalized = value.trim().replace(/^\$/, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function normalizeUsStateName(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return '';
  const byAbbreviation = US_STATE_NAMES[normalized.toUpperCase()];
  if (byAbbreviation) return byAbbreviation;
  return Object.values(US_STATE_NAMES).find(
    (stateName) => stateName.toLowerCase() === normalized.toLowerCase()
  ) ?? normalized;
}

export function isFullUsStateName(value: string) {
  const normalized = value.trim().toLowerCase();
  return Object.values(US_STATE_NAMES).some((stateName) => stateName.toLowerCase() === normalized);
}

export function isValidAbaRoutingNumber(value: string) {
  if (!/^\d{9}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8]);
  return checksum % 10 === 0;
}
