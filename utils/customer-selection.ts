import type { CustomerLookupRecord } from '@/types/customer';

export function normalizeCustomerIdentifier(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function hasCustomerIdentifier(value: string | null | undefined) {
  return Boolean(normalizeCustomerIdentifier(value));
}

export function matchesCustomerInsuredId(
  insuredId: string | null | undefined,
  candidateInsuredId: string | null | undefined
) {
  const normalizedInsuredId = normalizeCustomerIdentifier(insuredId);
  const normalizedCandidate = normalizeCustomerIdentifier(candidateInsuredId);

  return Boolean(normalizedInsuredId && normalizedCandidate && normalizedInsuredId === normalizedCandidate);
}

export function pickPreferredCustomerLookup(
  customers: CustomerLookupRecord[],
  preferredInsuredId?: string | null
) {
  return (
    customers.find((customer) => matchesCustomerInsuredId(customer.insuredId, preferredInsuredId)) ??
    customers.find((customer) => customer.active && hasCustomerIdentifier(customer.insuredId)) ??
    customers.find((customer) => customer.active) ??
    customers.find((customer) => hasCustomerIdentifier(customer.insuredId)) ??
    customers[0] ??
    null
  );
}
