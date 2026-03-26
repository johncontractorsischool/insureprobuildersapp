import { CustomerLookupRecord } from '@/types/customer';

const DEFAULT_CUSTOMER_API_BASE_URL = 'http://localhost:3000';

function getCustomerApiBaseUrl() {
  return process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() || DEFAULT_CUSTOMER_API_BASE_URL;
}

export async function fetchCustomersByEmail(email: string): Promise<CustomerLookupRecord[]> {
  const url = `${getCustomerApiBaseUrl()}/getCustomer?Email=${encodeURIComponent(email)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Customer lookup failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected customer lookup response format.');
  }

  return payload as CustomerLookupRecord[];
}
