import { resolveApiBaseUrl } from '@/services/api-base-url';
import { getSupabaseClient } from '@/services/supabase';
import type {
  PaymentEligibility,
  PaymentEligibilityList,
  PaymentInstallment,
  PaymentRecordType,
  PaymentTermOption,
  SubmitPaymentRequest,
  SuccessfulPayment,
} from '@/types/payment';

type ListPaymentEligibilityOptions = {
  page?: number;
  pageSize?: number;
  recordType?: PaymentRecordType;
  recordId?: string;
};

const LOCAL_DEVELOPMENT_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

type ErrorPayload = {
  message?: unknown;
};

export class PaymentApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentApiError';
    this.status = status;
  }
}

function getPaymentApiBaseUrl() {
  const baseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_PBIA_API_BASE_URL);
  if (!baseUrl) {
    throw new PaymentApiError(503, 'Mobile payments are not configured for this app environment.');
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new PaymentApiError(503, 'The mobile payment service URL is invalid.');
  }

  const isLocalDevelopmentUrl =
    process.env.NODE_ENV !== 'production' &&
    parsed.protocol === 'http:' &&
    LOCAL_DEVELOPMENT_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !isLocalDevelopmentUrl) {
    throw new PaymentApiError(503, 'Mobile payments require a secure HTTPS connection.');
  }

  return baseUrl;
}

function normalizeClientEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new PaymentApiError(400, 'A valid signed-in client email is required.');
  }
  return normalized;
}

function normalizeRequiredId(value: string, description: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new PaymentApiError(400, `${description} is required.`);
  }
  return normalized;
}

async function buildHeaders(
  clientEmail: string,
  additionalHeaders: Record<string, string> = {}
) {
  const requestedEmail = normalizeClientEmail(clientEmail);
  let sessionEmail: string;
  let accessToken: string;
  try {
    const { data, error } = await getSupabaseClient().auth.getSession();
    const session = data.session;
    if (error || !session?.access_token || !session.user.email) {
      throw new Error('Missing session');
    }
    sessionEmail = normalizeClientEmail(session.user.email);
    accessToken = session.access_token;
  } catch {
    throw new PaymentApiError(
      401,
      'Your secure sign-in session is unavailable. Please sign in again.'
    );
  }

  if (sessionEmail !== requestedEmail) {
    throw new PaymentApiError(401, 'Your signed-in account changed. Please sign in again.');
  }

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...additionalHeaders,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as ErrorPayload).message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (Array.isArray(message)) {
    const messages = message.filter(
      (entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())
    );
    if (messages.length > 0) return messages.join('\n');
  }
  return fallback;
}

async function throwResponseError(response: Response, fallback: string): Promise<never> {
  const payload = await readJson(response);
  throw new PaymentApiError(response.status, getErrorMessage(payload, fallback));
}

function isPaymentEligibility(value: unknown): value is PaymentEligibility {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PaymentEligibility>;
  const termOptions = Array.isArray(record.termOptions) ? record.termOptions : [];
  const termOptionsAreValid =
    Array.isArray(record.termOptions) &&
    termOptions.every(isPaymentTermOption) &&
    new Set(termOptions.map((option) => option.id)).size === termOptions.length &&
    new Set(termOptions.map((option) => option.termYears)).size === termOptions.length;
  const installments = Array.isArray(record.installments) ? record.installments : [];
  const installmentsAreValid =
    Array.isArray(record.installments) &&
    installments.every(isPaymentInstallment) &&
    new Set(installments.map((installment) => installment.id)).size === installments.length &&
    new Set(installments.map((installment) => installment.installmentNumber)).size === installments.length;
  const planFieldsAreValid =
    (record.paymentPlanId === null &&
      record.planPaymentChoice === null &&
      record.fullPaymentDemandId === null &&
      record.installmentNumber === null &&
      record.installmentCount === null &&
      record.planTotalAmount === null &&
      installments.length === 0) ||
    (typeof record.paymentPlanId === 'string' &&
      Boolean(record.paymentPlanId.trim()) &&
      (record.planPaymentChoice === 'AVAILABLE' || record.planPaymentChoice === 'INSTALLMENTS_ONLY') &&
      (record.fullPaymentDemandId === null ||
        (typeof record.fullPaymentDemandId === 'string' && Boolean(record.fullPaymentDemandId.trim()))) &&
      (record.installmentNumber === null ||
        (typeof record.installmentNumber === 'number' && Number.isInteger(record.installmentNumber) && record.installmentNumber >= 1)) &&
      (record.installmentCount === null ||
        (typeof record.installmentCount === 'number' && Number.isInteger(record.installmentCount) && record.installmentCount >= 2 && record.installmentCount <= 24)) &&
      (record.planTotalAmount === null ||
        (typeof record.planTotalAmount === 'number' && Number.isFinite(record.planTotalAmount) && record.planTotalAmount > 0)) &&
      installmentsAreValid);
  return (
    typeof record.demandId === 'string' &&
    (record.source === 'REPLICA' || record.source === 'CRM') &&
    typeof record.accountId === 'string' &&
    typeof record.accountName === 'string' &&
    typeof record.recordId === 'string' &&
    (record.recordType === 'POLICY' || record.recordType === 'QUOTE') &&
    typeof record.lineOfBusiness === 'string' &&
    typeof record.premium === 'number' &&
    typeof record.paidAmount === 'number' &&
    typeof record.amountDue === 'number' &&
    (record.paymentMode === 'FIXED' ||
      record.paymentMode === 'TERM_OPTIONS' ||
      record.paymentMode === 'INSTALLMENTS') &&
    (record.selectedOptionId === null || typeof record.selectedOptionId === 'string') &&
    termOptionsAreValid &&
    ((record.paymentMode === 'FIXED' &&
      record.selectedOptionId === null &&
      termOptions.length === 0) ||
    (record.paymentMode === 'TERM_OPTIONS' &&
      record.selectedOptionId === null &&
      termOptions.length >= 2 &&
      termOptions.length <= 5) ||
    (record.paymentMode === 'INSTALLMENTS' &&
      record.selectedOptionId === null &&
      termOptions.length === 0)) &&
    planFieldsAreValid &&
    (record.cardConvenienceFee === null || typeof record.cardConvenienceFee === 'number') &&
    (record.cardTotalAmount === null || typeof record.cardTotalAmount === 'number') &&
    ((record.cardConvenienceFee === null && record.cardTotalAmount === null) ||
      (typeof record.cardConvenienceFee === 'number' &&
        record.cardConvenienceFee >= 0 &&
        typeof record.cardTotalAmount === 'number' &&
        record.cardTotalAmount >= record.amountDue)) &&
    (record.achConvenienceFee === null || typeof record.achConvenienceFee === 'number') &&
    (record.achTotalAmount === null || typeof record.achTotalAmount === 'number') &&
    ((record.achConvenienceFee === null && record.achTotalAmount === null) ||
      (typeof record.achConvenienceFee === 'number' &&
        record.achConvenienceFee >= 0 &&
        typeof record.achTotalAmount === 'number' &&
        record.achTotalAmount >= record.amountDue)) &&
    (record.purpose === 'PREMIUM' ||
      record.purpose === 'PREMIUM_AUDIT' ||
      record.purpose === 'DOWN_PAYMENT' ||
      record.purpose === 'INSTALLMENT' ||
      record.purpose === 'POLICY_FEE' ||
      record.purpose === 'OTHER') &&
    record.status === 'PUBLISHED' &&
    record.paymentState === 'DUE' &&
    record.paymentNeeded === true &&
    (record.dueStatus === 'UPCOMING' ||
      record.dueStatus === 'DUE' ||
      record.dueStatus === 'OVERDUE') &&
    Array.isArray(record.missing) &&
    record.missing.every((entry) => typeof entry === 'string') &&
    (record.dueDate === null || typeof record.dueDate === 'string') &&
    (record.clientMessage === null || typeof record.clientMessage === 'string')
  );
}

function normalizePaymentEligibility(value: unknown): PaymentEligibility | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const normalized = {
    ...record,
    // Payment demands created before installment support do not include plan
    // metadata. Treat those records as standalone demands while preserving
    // strict validation for every field the server did provide.
    paymentPlanId: record.paymentPlanId === undefined ? null : record.paymentPlanId,
    planPaymentChoice:
      record.planPaymentChoice === undefined ? null : record.planPaymentChoice,
    fullPaymentDemandId:
      record.fullPaymentDemandId === undefined ? null : record.fullPaymentDemandId,
    installmentNumber:
      record.installmentNumber === undefined ? null : record.installmentNumber,
    installmentCount:
      record.installmentCount === undefined ? null : record.installmentCount,
    planTotalAmount:
      record.planTotalAmount === undefined ? null : record.planTotalAmount,
    installments: record.installments === undefined ? [] : record.installments,
    dueStatus: record.dueStatus === undefined ? 'DUE' : record.dueStatus,
  };

  return isPaymentEligibility(normalized) ? normalized : null;
}

function isPaymentInstallment(value: unknown): value is PaymentInstallment {
  if (!value || typeof value !== 'object') return false;
  const installment = value as Partial<PaymentInstallment>;
  return (
    typeof installment.id === 'string' &&
    Boolean(installment.id.trim()) &&
    typeof installment.installmentNumber === 'number' &&
    Number.isInteger(installment.installmentNumber) &&
    installment.installmentNumber >= 1 &&
    typeof installment.amount === 'number' &&
    Number.isFinite(installment.amount) &&
    installment.amount > 0 &&
    (installment.dueDate === null || typeof installment.dueDate === 'string') &&
    (installment.status === 'DRAFT' ||
      installment.status === 'PUBLISHED' ||
      installment.status === 'PROCESSING' ||
      installment.status === 'PAID' ||
      installment.status === 'CANCELLED') &&
    (installment.paymentLink === undefined ||
      installment.paymentLink === null ||
      typeof installment.paymentLink === 'string') &&
    isFeePreview(installment.amount, installment.cardConvenienceFee, installment.cardTotalAmount) &&
    isFeePreview(installment.amount, installment.achConvenienceFee, installment.achTotalAmount)
  );
}

function isFeePreview(
  amount: number,
  fee: unknown,
  total: unknown
): fee is number | null {
  return (
    (fee === null && total === null) ||
    (typeof fee === 'number' &&
      Number.isFinite(fee) &&
      fee >= 0 &&
      typeof total === 'number' &&
      Number.isFinite(total) &&
      total >= amount)
  );
}

function isPaymentTermOption(value: unknown): value is PaymentTermOption {
  if (!value || typeof value !== 'object') return false;
  const option = value as Partial<PaymentTermOption>;
  return (
    typeof option.id === 'string' &&
    Boolean(option.id.trim()) &&
    typeof option.termYears === 'number' &&
    Number.isInteger(option.termYears) &&
    option.termYears >= 1 &&
    option.termYears <= 5 &&
    typeof option.amount === 'number' &&
    Number.isFinite(option.amount) &&
    option.amount > 0 &&
    typeof option.currency === 'string' &&
    Boolean(option.currency.trim()) &&
    typeof option.label === 'string' &&
    Boolean(option.label.trim()) &&
    isFeePreview(option.amount, option.cardConvenienceFee, option.cardTotalAmount) &&
    isFeePreview(option.amount, option.achConvenienceFee, option.achTotalAmount)
  );
}

function parseEligibilityList(payload: unknown): PaymentEligibilityList {
  if (!payload || typeof payload !== 'object') {
    throw new PaymentApiError(500, 'Unexpected payment eligibility response format.');
  }

  const result = payload as Partial<PaymentEligibilityList>;
  if (
    !Array.isArray(result.data) ||
    typeof result.page !== 'number' ||
    typeof result.pageSize !== 'number' ||
    typeof result.total !== 'number' ||
    typeof result.totalPages !== 'number'
  ) {
    throw new PaymentApiError(500, 'Unexpected payment eligibility response format.');
  }

  const data = result.data.map(normalizePaymentEligibility);
  if (data.some((record) => record === null)) {
    throw new PaymentApiError(500, 'Unexpected payment eligibility response format.');
  }

  return {
    data: data as PaymentEligibility[],
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  };
}

export async function listPaymentEligibility(
  clientEmail: string,
  accountId: string,
  options: ListPaymentEligibilityOptions = {}
): Promise<PaymentEligibilityList> {
  const normalizedAccountId = normalizeRequiredId(accountId, 'A client account');
  const url = new URL(`${getPaymentApiBaseUrl()}/client/payment-eligibility`);
  url.searchParams.set('accountId', normalizedAccountId);
  url.searchParams.set('page', String(options.page ?? 1));
  url.searchParams.set('pageSize', String(options.pageSize ?? 20));
  if (options.recordType) url.searchParams.set('recordType', options.recordType);
  if (options.recordId?.trim()) url.searchParams.set('recordId', options.recordId.trim());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await buildHeaders(clientEmail),
  });
  if (!response.ok) {
    return throwResponseError(response, 'Unable to load payment eligibility.');
  }

  return parseEligibilityList(await readJson(response));
}

export async function getPaymentEligibility(
  clientEmail: string,
  accountId: string,
  demandId: string
): Promise<PaymentEligibility> {
  const normalizedAccountId = normalizeRequiredId(accountId, 'A client account');
  const normalizedDemandId = normalizeRequiredId(demandId, 'A payment demand');

  const url = `${getPaymentApiBaseUrl()}/client/payment-eligibility/${encodeURIComponent(normalizedDemandId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: await buildHeaders(clientEmail, {
      'X-Client-Account-Id': normalizedAccountId,
    }),
  });
  if (!response.ok) {
    return throwResponseError(response, 'Payment record unavailable.');
  }

  const payload = normalizePaymentEligibility(await readJson(response));
  if (!payload) {
    throw new PaymentApiError(500, 'Unexpected payment eligibility response format.');
  }
  return payload;
}

function isSuccessfulPayment(value: unknown): value is SuccessfulPayment {
  if (!value || typeof value !== 'object') return false;
  const payment = value as Partial<SuccessfulPayment>;
  return (
    payment.status === 'SUCCEEDED' &&
    typeof payment.id === 'string' &&
    typeof payment.demandId === 'string' &&
    (payment.paymentOptionId === null || typeof payment.paymentOptionId === 'string') &&
    (payment.termYears === null ||
      (typeof payment.termYears === 'number' &&
        Number.isInteger(payment.termYears) &&
        payment.termYears >= 1 &&
        payment.termYears <= 5)) &&
    ((payment.paymentOptionId === null && payment.termYears === null) ||
      (typeof payment.paymentOptionId === 'string' && typeof payment.termYears === 'number')) &&
    typeof payment.amount === 'number' &&
    (payment.convenienceFee === null || typeof payment.convenienceFee === 'number') &&
    (payment.addOnConvenienceFee === null || typeof payment.addOnConvenienceFee === 'number') &&
    (payment.totalCharged === null || typeof payment.totalCharged === 'number') &&
    payment.currency === 'USD' &&
    typeof payment.purpose === 'string' &&
    (payment.receiptId === null || typeof payment.receiptId === 'string') &&
    (payment.completedAt === null || typeof payment.completedAt === 'string')
  );
}

export async function submitPayment(
  clientEmail: string,
  accountId: string,
  demandId: string,
  idempotencyKey: string,
  payment: SubmitPaymentRequest
): Promise<SuccessfulPayment> {
  const normalizedAccountId = normalizeRequiredId(accountId, 'A client account');
  const normalizedDemandId = normalizeRequiredId(demandId, 'A payment demand');
  const normalizedKey = idempotencyKey.trim();
  if (!normalizedKey) {
    throw new PaymentApiError(400, 'A unique payment idempotency key is required.');
  }

  const url = `${getPaymentApiBaseUrl()}/client/payment-eligibility/${encodeURIComponent(normalizedDemandId)}/payments`;
  const response = await fetch(url, {
    method: 'POST',
    headers: await buildHeaders(clientEmail, {
      'Content-Type': 'application/json',
      'Idempotency-Key': normalizedKey,
      'X-Client-Account-Id': normalizedAccountId,
    }),
    body: JSON.stringify(payment),
  });
  if (!response.ok) {
    return throwResponseError(response, 'Unable to confirm your payment.');
  }

  const payload = await readJson(response);
  if (!isSuccessfulPayment(payload)) {
    throw new PaymentApiError(
      502,
      'We could not confirm your payment. Please contact PBIA before trying again.'
    );
  }
  return payload;
}
