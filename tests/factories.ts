import type { Customer, CustomerLookupRecord } from '@/types/customer';
import type { Policy } from '@/types/policy';
import type { PolicyFileEntry } from '@/types/policy-file';

export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    databaseId: 'insured-db-1',
    insuredId: 'LIC-123456',
    customerId: 'customer-1',
    fullName: 'Jane Builder',
    firstName: 'Jane',
    lastName: 'Builder',
    type: 1,
    email: 'jane@example.com',
    phone: '5551112222',
    cellPhone: '5559990000',
    commercialName: 'Builder Co',
    active: true,
    ...overrides,
  };
}

export function buildCustomerLookupRecord(
  overrides: Partial<CustomerLookupRecord> = {}
): CustomerLookupRecord {
  return {
    databaseId: 'insured-db-1',
    commercialName: 'Builder Co',
    firstName: 'Jane',
    lastName: 'Builder',
    type: 1,
    addressLine1: '123 Main St',
    addressLine2: null,
    stateNameOrAbbreviation: 'CA',
    city: 'Los Angeles',
    zipCode: '90001',
    eMail: 'jane@example.com',
    eMail2: null,
    eMail3: null,
    fax: null,
    phone: '5551112222',
    cellPhone: '5559990000',
    smsPhone: '5559990000',
    description: null,
    active: true,
    website: null,
    fein: null,
    customerId: 'customer-1',
    insuredId: 'LIC-123456',
    ...overrides,
  };
}

export function buildPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: 'policy-1',
    productName: 'General Liability',
    status: 'Active',
    policyNumber: 'GL-1001',
    carrierName: 'Carrier Co',
    premiumMonthly: 1200,
    effectiveDate: '2026-01-01T00:00:00.000Z',
    expirationDate: '2027-01-01T00:00:00.000Z',
    insuredName: 'Jane Builder',
    insuredItem: 'General Liability • Carrier Co',
    coverageSummary: [{ label: 'Carrier', value: 'Carrier Co' }],
    billing: {
      plan: 'Agency billed',
      monthlyPremium: 1200,
      nextDueDate: '2027-01-01T00:00:00.000Z',
      lastPaymentDate: '2026-02-01T00:00:00.000Z',
      autopayEnabled: false,
    },
    documents: [],
    claimsPlaceholder: 'Claims unavailable',
    ...overrides,
  };
}

export function buildPolicyFileEntry(overrides: Partial<PolicyFileEntry> = {}): PolicyFileEntry {
  return {
    databaseId: 'file-1',
    insuredId: 'insured-db-1',
    policyId: 'policy-1',
    policyNumber: 'GL-1001',
    name: 'Declarations',
    type: 1,
    createDate: '2026-02-01T10:00:00.000Z',
    changeDate: '2026-02-02T10:00:00.000Z',
    creatorName: 'Portal User',
    fileOrFolder: 'File',
    fileUrl: 'https://example.com/file.pdf',
    downloadUrl: null,
    url: null,
    ...overrides,
  };
}
