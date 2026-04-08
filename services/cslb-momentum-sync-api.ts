import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_CSLB_MOMENTUM_API_BASE_URL = 'http://localhost:3000';

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
    throw new Error('Unable to reach sync service. Check your connection and try again.');
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(buildHttpErrorMessage(response, payload));
  }

  return parseSyncSuccessPayload(payload);
}
