export type PaymentRecordType = 'POLICY' | 'QUOTE';

export type PaymentDemandSource = 'REPLICA' | 'CRM';

export type PaymentPurpose =
  | 'PREMIUM'
  | 'DOWN_PAYMENT'
  | 'INSTALLMENT'
  | 'POLICY_FEE'
  | 'OTHER';

export type PaymentEligibility = {
  demandId: string;
  source: PaymentDemandSource;
  accountId: string;
  accountName: string;
  recordId: string;
  recordType: PaymentRecordType;
  quoteCreationRequestId: string | null;
  policyNumber: string | null;
  status: 'PUBLISHED';
  lineOfBusiness: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  premium: number;
  paidAmount: number;
  amountDue: number;
  cardConvenienceFee: number | null;
  cardTotalAmount: number | null;
  achConvenienceFee: number | null;
  achTotalAmount: number | null;
  purpose: PaymentPurpose;
  paymentState: 'DUE';
  paymentNeeded: true;
  missing: string[];
  dueDate: string | null;
  clientMessage: string | null;
};

export type PaymentEligibilityList = {
  data: PaymentEligibility[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaymentMethod = 'CARD' | 'ACH';

export type CardType = 'AmericanExpress' | 'Discover' | 'Mastercard' | 'Visa';

export type AchBankAccountType = 'Checking' | 'Savings';

export type AchAccountType = 'Business' | 'Personal';

export type PaymentPayer = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  country: 'United States Of America';
  city: string;
  region: string;
  postalCode: string;
  email: string;
  phone?: string;
};

export type CardPaymentInstrument = PaymentPayer & {
  creditCardType: CardType;
  creditCardNumber: string;
  creditCardExpiration: string;
  creditCardSecurityCode: string;
};

export type AchPaymentInstrument = PaymentPayer & {
  achBankAccountType: AchBankAccountType;
  accountType: AchAccountType;
  achBankName: string;
  achRoutingNumber: string;
  achBankAccountNumber: string;
};

type SharedPaymentRequest = {
  amount: number;
  purpose: PaymentPurpose;
  emailReceipt: true;
  internalReference?: string;
  notes?: string;
};

export type CardPaymentRequest = SharedPaymentRequest & {
  paymentMethod: 'CARD';
  card: CardPaymentInstrument;
  ach?: never;
};

export type AchPaymentRequest = SharedPaymentRequest & {
  paymentMethod: 'ACH';
  ach: AchPaymentInstrument;
  card?: never;
};

export type SubmitPaymentRequest = CardPaymentRequest | AchPaymentRequest;

export type SuccessfulPayment = {
  id: string;
  demandId: string;
  status: 'SUCCEEDED';
  amount: number;
  convenienceFee: number | null;
  addOnConvenienceFee: number | null;
  totalCharged: number | null;
  currency: 'USD';
  purpose: PaymentPurpose;
  receiptId: string | null;
  completedAt: string | null;
};
