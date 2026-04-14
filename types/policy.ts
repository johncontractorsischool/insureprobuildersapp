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
  productName: string;
  status: PolicyStatus;
  policyNumber: string;
  carrierName: string;
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
