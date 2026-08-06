import { resolveApiBaseUrl } from '@/services/api-base-url';
import { getSupabaseClient } from '@/services/supabase';
import type {
  PaymentEligibility,
  PaymentEligibilityList,
  PaymentRecordType,
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
  return (
    typeof record.demandId === 'string' &&
    (record.source === 'REPLICA' || record.source === 'CRM') &&
    typeof record.accountId === 'string' &&
    typeof record.accountName === 'string' &&
    typeof record.recordId === 'string' &&
    (record.recordType === 'POLICY' || record.recordType === 'QUOTE') &&
    typeof record.premium === 'number' &&
    typeof record.paidAmount === 'number' &&
    typeof record.amountDue === 'number' &&
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
      record.purpose === 'DOWN_PAYMENT' ||
      record.purpose === 'INSTALLMENT' ||
      record.purpose === 'POLICY_FEE' ||
      record.purpose === 'OTHER') &&
    record.status === 'PUBLISHED' &&
    record.paymentState === 'DUE' &&
    record.paymentNeeded === true &&
    Array.isArray(record.missing) &&
    record.missing.every((entry) => typeof entry === 'string') &&
    (record.dueDate === null || typeof record.dueDate === 'string') &&
    (record.clientMessage === null || typeof record.clientMessage === 'string')
  );
}

function parseEligibilityList(payload: unknown): PaymentEligibilityList {
  if (!payload || typeof payload !== 'object') {
    throw new PaymentApiError(500, 'Unexpected payment eligibility response format.');
  }

  const result = payload as Partial<PaymentEligibilityList>;
  if (
    !Array.isArray(result.data) ||
    !result.data.every(isPaymentEligibility) ||
    typeof result.page !== 'number' ||
    typeof result.pageSize !== 'number' ||
    typeof result.total !== 'number' ||
    typeof result.totalPages !== 'number'
  ) {
    throw new PaymentApiError(500, 'Unexpected payment eligibility response format.');
  }

  return result as PaymentEligibilityList;
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

  const payload = await readJson(response);
  if (!isPaymentEligibility(payload)) {
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
