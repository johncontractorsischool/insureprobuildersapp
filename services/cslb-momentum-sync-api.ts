import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_CSLB_MOMENTUM_API_BASE_URL = 'http://localhost:3000';
const CSLB_MOMENTUM_SYNC_LOG_PREFIX = '[Signup Sync]';

export type CslbMomentumSyncRequest = {
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
  appFeeNumber: string;
  agentName: string;
};

export type CslbMomentumSyncStatus = 'existing' | 'created';

export type CslbMomentumSyncResult = {
  status: CslbMomentumSyncStatus;
  message: string;
  cslb: Record<string, unknown> | null;
  momentum: Record<string, unknown> | null;
};

export type CslbMomentumSyncSuccessResponse = {
  ok: true;
  result: CslbMomentumSyncResult;
};

function maskEmail(value: string) {
  const [name, domain] = value.split('@');
  if (!name || !domain) return value;
  const first = name.charAt(0);
  const last = name.charAt(name.length - 1);
  const middle = '*'.repeat(Math.max(2, name.length - 2));
  return `${first}${middle}${last}@${domain}`;
}

function logSignupSync(event: string, details: Record<string, unknown>) {
  console.log(`${CSLB_MOMENTUM_SYNC_LOG_PREFIX} ${event}`, details);
}

function logSignupSyncWarning(event: string, details: Record<string, unknown>) {
  console.warn(`${CSLB_MOMENTUM_SYNC_LOG_PREFIX} ${event}`, details);
}

function getCslbMomentumApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_CSLB_MOMENTUM_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_POLICY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() ||
    DEFAULT_CSLB_MOMENTUM_API_BASE_URL
  );
}

function toObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toOptionalObject(value: unknown) {
  return toObject(value);
}

function toText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildHttpErrorMessage(response: Response, payload: unknown) {
  const parsed = toObject(payload);
  const apiError = toText(parsed?.error);
  if (apiError) return apiError;
  return `Sync request failed (${response.status}).`;
}

function parseSyncSuccessPayload(payload: unknown): CslbMomentumSyncSuccessResponse {
  const parsed = toObject(payload);
  if (!parsed) {
    throw new Error('Unexpected sync response format.');
  }

  if (parsed.ok === false) {
    const apiError = toText(parsed.error);
    throw new Error(apiError ?? 'Sync request failed.');
  }

  if (parsed.ok !== true) {
    throw new Error('Unexpected sync response format.');
  }

  const result = toObject(parsed.result);
  if (!result) {
    throw new Error('Unexpected sync response format.');
  }

  const status = toText(result.status);
  if (status !== 'existing' && status !== 'created') {
    throw new Error('Unexpected sync status in response.');
  }

  const message = toText(result.message) ?? 'Sync completed successfully.';

  return {
    ok: true,
    result: {
      status,
      message,
      cslb: toOptionalObject(result.cslb),
      momentum: toOptionalObject(result.momentum),
    },
  };
}

async function parseJsonResponse(response: Response) {
  const rawBody = await response.text();
  if (!rawBody.trim()) return null;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('Unexpected sync response format.');
  }
}

export async function syncCslbMomentum(
  request: CslbMomentumSyncRequest
): Promise<CslbMomentumSyncSuccessResponse> {
  const endpoint = `${getCslbMomentumApiBaseUrl()}/api/cslb-momentum/sync`;
  const emailMasked = maskEmail(request.email);

  logSignupSync('request_started', {
    endpoint,
    emailMasked,
    hasLicenseNumber: Boolean(request.licenseNumber),
    hasAppFeeNumber: Boolean(request.appFeeNumber),
    hasAgentName: Boolean(request.agentName),
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: withApiKeyHeader({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(request),
    });
  } catch {
    logSignupSyncWarning('request_network_failed', {
      endpoint,
      emailMasked,
    });
    throw new Error('Unable to reach sync service. Check your connection and try again.');
  }

  const payload = await parseJsonResponse(response);
  logSignupSync('response_received', {
    endpoint,
    emailMasked,
    httpStatus: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    logSignupSyncWarning('request_http_failed', {
      endpoint,
      emailMasked,
      httpStatus: response.status,
      payload,
    });
    throw new Error(buildHttpErrorMessage(response, payload));
  }

  const parsed = parseSyncSuccessPayload(payload);
  logSignupSync('request_succeeded', {
    endpoint,
    emailMasked,
    syncStatus: parsed.result.status,
    syncMessage: parsed.result.message,
  });
  return parsed;
}
