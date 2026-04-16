import { CustomerLookupRecord } from '@/types/customer';
import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_CUSTOMER_API_BASE_URL = 'http://localhost:3000';

function getCustomerApiBaseUrl() {
  return process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() || DEFAULT_CUSTOMER_API_BASE_URL;
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

type InsuredProfileUpdateInput = {
  databaseId?: string | null;
  type?: number | null;
  commercialName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  cellPhone?: string | null;
};

function buildAddCustomerPayload(input: InsuredProfileUpdateInput) {
  const payload: Record<string, string | number | null> = {
    databaseId: normalizeText(input.databaseId),
    eMail: input.email.trim(),
  };

  if (typeof input.type === 'number') {
    payload.type = input.type;
  }

  const commercialName = normalizeText(input.commercialName);
  if (commercialName) {
    payload.commercialName = commercialName;
  }

  const firstName = normalizeText(input.firstName);
  if (firstName) {
    payload.firstName = firstName;
  }

  const lastName = normalizeText(input.lastName);
  if (lastName) {
    payload.lastName = lastName;
  }

  const phone = normalizeText(input.phone);
  if (phone) {
    payload.phone = phone;
  }

  const cellPhone = normalizeText(input.cellPhone);
  if (cellPhone) {
    payload.cellPhone = cellPhone;
  }

  return payload;
}

async function requestAddCustomer(payload: Record<string, string | number | null>) {
  return fetch(`${getCustomerApiBaseUrl()}/addCustomer`, {
    method: 'POST',
    headers: withApiKeyHeader({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
}

export async function fetchCustomersByEmail(email: string): Promise<CustomerLookupRecord[]> {
  const url = `${getCustomerApiBaseUrl()}/getCustomer?Email=${encodeURIComponent(email)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: withApiKeyHeader({ Accept: 'application/json' }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }

    if (response.status >= 500) {
      throw new Error('We are having trouble finding your account right now. Please try again shortly.');
    }

    throw new Error('We could not verify that email right now. Please try again.');
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected customer lookup response format.');
  }

  return payload as CustomerLookupRecord[];
}

export async function updateInsuredProfile(input: InsuredProfileUpdateInput): Promise<void> {
  const response = await requestAddCustomer(buildAddCustomerPayload(input));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'The NowCerts profile update endpoint is not available yet. Enable POST /addCustomer on the backend to save profile edits.'
      );
    }

    if (response.status >= 500) {
      throw new Error('We could not save your profile changes right now. Please try again shortly.');
    }

    const message = await response.text();
    const normalizedMessage = message.trim();
    if (normalizedMessage) {
      throw new Error(normalizedMessage);
    }

    throw new Error('We could not save your profile changes right now. Please review your changes and try again.');
  }

  const commercialName = normalizeText(input.commercialName);
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);

  if (commercialName && (firstName || lastName)) {
    const commercialNameRefreshPayload = buildAddCustomerPayload({
      databaseId: input.databaseId,
      type: input.type,
      commercialName,
      email: input.email,
      phone: input.phone,
      cellPhone: input.cellPhone,
    });
    const commercialNameResponse = await requestAddCustomer(commercialNameRefreshPayload);

    if (!commercialNameResponse.ok) {
      if (commercialNameResponse.status >= 500) {
        throw new Error('We saved your profile, but could not restore the business name right now. Please try again shortly.');
      }

      const message = await commercialNameResponse.text();
      const normalizedMessage = message.trim();
      if (normalizedMessage) {
        throw new Error(normalizedMessage);
      }

      throw new Error('We saved your profile, but could not restore the business name right now. Please review your changes and try again.');
    }
  }
}

export type { InsuredProfileUpdateInput };
