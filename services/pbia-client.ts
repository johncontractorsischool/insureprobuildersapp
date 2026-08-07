import { resolveApiBaseUrl } from '@/services/api-base-url';
import { getSupabaseClient } from '@/services/supabase';

type PbiaErrorPayload = {
  message?: unknown;
};

type PbiaRequestOptions = Omit<RequestInit, 'headers'> & {
  clientEmail: string;
  headers?: Record<string, string>;
};

export class PbiaApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PbiaApiError';
    this.status = status;
  }
}

export function getPbiaApiBaseUrl() {
  const baseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_PBIA_API_BASE_URL);
  if (!baseUrl) {
    throw new PbiaApiError(503, 'The PBIA client API is not configured for this app environment.');
  }

  try {
    return new URL(baseUrl).toString().replace(/\/+$/, '');
  } catch {
    throw new PbiaApiError(503, 'The PBIA client API URL is invalid.');
  }
}

export function normalizeClientEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new PbiaApiError(400, 'A valid client email is required.');
  }
  return normalized;
}

async function buildPbiaHeaders(clientEmail: string, additionalHeaders: Record<string, string>) {
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
    throw new PbiaApiError(
      401,
      'Your secure sign-in session is unavailable. Please sign in again.'
    );
  }

  if (sessionEmail !== requestedEmail) {
    throw new PbiaApiError(401, 'Your signed-in account changed. Please sign in again.');
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

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as PbiaErrorPayload).message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (Array.isArray(message)) {
    const entries = message.filter(
      (entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())
    );
    if (entries.length > 0) return entries.join('\n');
  }
  return fallback;
}

export async function pbiaRequest<T>(
  path: string,
  options: PbiaRequestOptions,
  fallbackError: string
): Promise<T> {
  const { clientEmail, headers = {}, ...requestInit } = options;
  const response = await fetch(`${getPbiaApiBaseUrl()}${path}`, {
    ...requestInit,
    headers: await buildPbiaHeaders(clientEmail, headers),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new PbiaApiError(response.status, errorMessage(payload, fallbackError));
  }

  return payload as T;
}

export function buildClientQuery(values: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') continue;
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}
