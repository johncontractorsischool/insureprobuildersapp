export type PaymentRecordType = 'POLICY' | 'QUOTE';

export type PaymentDemandSource = 'REPLICA' | 'CRM';

export type PaymentMode = 'FIXED' | 'TERM_OPTIONS' | 'INSTALLMENTS';

export type PaymentPlanChoice = 'AVAILABLE' | 'INSTALLMENTS_ONLY';

export type PaymentPurpose =
  | 'PREMIUM'
  | 'PREMIUM_AUDIT'
  | 'DOWN_PAYMENT'
  | 'INSTALLMENT'
  | 'POLICY_FEE'
  | 'OTHER';

export type PaymentTermOption = {
  id: string;
  termYears: number;
  amount: number;
  currency: string;
  label: string;
  cardConvenienceFee: number | null;
  cardTotalAmount: number | null;
  achConvenienceFee: number | null;
  achTotalAmount: number | null;
};

export type PaymentInstallment = {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'PROCESSING' | 'PAID' | 'CANCELLED';
  paymentLinkIssuedAt: string | null;
  paymentLinkExpiresAt: string | null;
  cardConvenienceFee: number | null;
  cardTotalAmount: number | null;
  achConvenienceFee: number | null;
  achTotalAmount: number | null;
};

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
  lineOfBusiness: string;
  effectiveDate: string | null;
  expirationDate: string | null;
  premium: number;
  paidAmount: number;
  amountDue: number;
  paymentPlanId: string | null;
  paymentMode: PaymentMode;
  planPaymentChoice: PaymentPlanChoice | null;
  fullPaymentDemandId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  planTotalAmount: number | null;
  installments: PaymentInstallment[];
  selectedOptionId: string | null;
  termOptions: PaymentTermOption[];
  cardConvenienceFee: number | null;
  cardTotalAmount: number | null;
  achConvenienceFee: number | null;
  achTotalAmount: number | null;
  purpose: PaymentPurpose;
  paymentState: 'DUE';
  paymentNeeded: true;
  missing: string[];
  dueDate: string | null;
  dueStatus: 'UPCOMING' | 'DUE' | 'OVERDUE';
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
  emailReceipt: true;
  internalReference?: string;
  notes?: string;
};

type FixedPaymentSelection = {
  amount: number;
  purpose: PaymentPurpose;
  paymentOptionId?: never;
};

type TermPaymentSelection = {
  paymentOptionId: string;
  amount?: never;
  purpose?: never;
};

type PaymentSelection = FixedPaymentSelection | TermPaymentSelection;

export type CardPaymentRequest = SharedPaymentRequest &
  PaymentSelection & {
    paymentMethod: 'CARD';
    card: CardPaymentInstrument;
    ach?: never;
  };

export type AchPaymentRequest = SharedPaymentRequest &
  PaymentSelection & {
    paymentMethod: 'ACH';
    ach: AchPaymentInstrument;
    card?: never;
  };

export type SubmitPaymentRequest = CardPaymentRequest | AchPaymentRequest;

export type SuccessfulPayment = {
  id: string;
  demandId: string;
  paymentOptionId: string | null;
  termYears: number | null;
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
