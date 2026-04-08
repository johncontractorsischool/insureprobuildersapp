import { CustomerLookupRecord } from '@/types/customer';
import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_CUSTOMER_API_BASE_URL = 'http://localhost:3000';

function getCustomerApiBaseUrl() {
  return process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() || DEFAULT_CUSTOMER_API_BASE_URL;
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
