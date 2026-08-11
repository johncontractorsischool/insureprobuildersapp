export type PolicyStatus = 'Active' | 'Pending' | 'Lapsed';

export type CoverageLineItem = {
  label: string;
  value: string;
};

export type BillingSummary = {
  plan: string;
  monthlyPremium: number;
  nextDueDate: string;
  lastPaymentDate: string;
  autopayEnabled: boolean;
};

export type PolicyDocument = {
  id: string;
  name: string;
  updatedAt: string;
};

export type Policy = {
  id: string;
  accountId?: string;
  recordType?: 'POLICY' | 'QUOTE';
  lineOfBusiness?: string | null;
  productName: string;
  status: PolicyStatus;
  policyNumber: string;
  carrierName: string;
  premium?: number;
  // Compatibility alias retained for older cached/demo policy objects.
  premiumMonthly: number;
  effectiveDate: string;
  expirationDate: string;
  insuredName: string;
  insuredItem: string;
  coverageSummary: CoverageLineItem[];
  billing: BillingSummary;
  documents: PolicyDocument[];
  claimsPlaceholder: string;
};
