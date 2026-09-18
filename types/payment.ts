export type PaymentRecordType = 'POLICY' | 'QUOTE';

export type PaymentDemandSource = 'REPLICA' | 'CRM';

export type PaymentMode = 'FIXED' | 'TERM_OPTIONS' | 'INSTALLMENTS';

export type PaymentPlanChoice = 'AVAILABLE' | 'INSTALLMENTS_ONLY';

export type PremiumPaymentOption = 'FULL_PREMIUM' | 'FINANCED_PREMIUM';

export type PremiumPaymentOffer = 'FULL_PREMIUM_ONLY' | 'FINANCED_PREMIUM_ONLY' | 'BOTH';

export type PremiumPaymentTerms = {
  fullPremium: number;
  downPayment: number;
  paymentCount: number;
  paymentAmount: number;
};

export type PremiumPricingFields = {
  financing?: PremiumPaymentTerms | null;
  financedCardConvenienceFee?: number | null;
  financedCardTotalAmount?: number | null;
  financedAchConvenienceFee?: number | null;
  financedAchTotalAmount?: number | null;
};

export type PaymentPurpose =
  | 'PREMIUM'
  | 'PREMIUM_AUDIT'
  | 'DOWN_PAYMENT'
  | 'INSTALLMENT'
  | 'POLICY_FEE'
  | 'OTHER';

export type PaymentTermOption = PremiumPricingFields & {
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
  paymentLink?: string | null;
  cardConvenienceFee: number | null;
  cardTotalAmount: number | null;
  achConvenienceFee: number | null;
  achTotalAmount: number | null;
};

export type PaymentEligibility = PremiumPricingFields & {
  premiumPaymentOffer?: PremiumPaymentOffer | null;
  pricingVersion?: string;
  premiumPaymentOption?: PremiumPaymentOption | null;
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
  premiumPaymentOption?: never;
  pricingVersion?: never;
  amount: number;
  purpose: PaymentPurpose;
  paymentOptionId?: never;
};

type TermPaymentSelection = {
  premiumPaymentOption?: never;
  pricingVersion?: never;
  paymentOptionId: string;
  amount?: never;
  purpose?: never;
};

type PremiumPaymentSelection = {
  premiumPaymentOption: PremiumPaymentOption;
  pricingVersion: string;
  paymentOptionId?: string;
  amount?: never;
  purpose?: never;
};

export type PaymentSelection = FixedPaymentSelection | TermPaymentSelection | PremiumPaymentSelection;

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
  premiumPaymentOption?: PremiumPaymentOption | null;
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
