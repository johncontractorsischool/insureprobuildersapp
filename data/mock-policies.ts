import { Policy } from '@/types/policy';

export const mockPolicies: Policy[] = [
  {
    id: 'home-102847',
    productName: 'Premier Home Protection',
    status: 'Active',
    policyNumber: 'HP-102847-CA',
    premiumMonthly: 248.35,
    effectiveDate: '2025-09-01',
    renewalDate: '2026-09-01',
    insuredName: 'Alex Morgan',
    insuredItem: 'Primary Residence - 482 Seacliff Drive, San Diego, CA',
    coverageSummary: [
      { label: 'Dwelling', value: '$950,000 limit' },
      { label: 'Personal Property', value: '$420,000 limit' },
      { label: 'Liability', value: '$1,000,000 limit' },
      { label: 'Deductible', value: '$1,500 all perils' },
    ],
    billing: {
      plan: 'Monthly AutoPay',
      monthlyPremium: 248.35,
      nextDueDate: '2026-04-01',
      lastPaymentDate: '2026-03-01',
      autopayEnabled: true,
    },
    documents: [
      { id: 'doc-home-dec', name: 'Declarations Page', updatedAt: '2026-01-12' },
      { id: 'doc-home-terms', name: 'Policy Terms and Conditions', updatedAt: '2025-09-01' },
    ],
    claimsPlaceholder: 'No open claims. Claim filing module will connect to API in a future release.',
  },
  {
    id: 'auto-774231',
    productName: 'Elite Auto Coverage',
    status: 'Active',
    policyNumber: 'AU-774231-CA',
    premiumMonthly: 186.9,
    effectiveDate: '2024-11-15',
    renewalDate: '2026-11-15',
    insuredName: 'Alex Morgan',
    insuredItem: '2024 Lexus RX 350',
    coverageSummary: [
      { label: 'Bodily Injury', value: '$250,000 / $500,000' },
      { label: 'Property Damage', value: '$100,000' },
      { label: 'Collision', value: '$1,000 deductible' },
      { label: 'Comprehensive', value: '$500 deductible' },
    ],
    billing: {
      plan: 'Monthly AutoPay',
      monthlyPremium: 186.9,
      nextDueDate: '2026-04-15',
      lastPaymentDate: '2026-03-15',
      autopayEnabled: true,
    },
    documents: [
      { id: 'doc-auto-card', name: 'Proof of Insurance Card', updatedAt: '2026-02-18' },
      { id: 'doc-auto-dec', name: 'Auto Declarations', updatedAt: '2025-11-15' },
    ],
    claimsPlaceholder:
      'Roadside and claim request actions are shown here as placeholders until backend claims APIs are connected.',
  },
  {
    id: 'life-003912',
    productName: 'Lifetime Security Plan',
    status: 'Pending',
    policyNumber: 'LF-003912-CA',
    premiumMonthly: 121.5,
    effectiveDate: '2026-04-01',
    renewalDate: '2027-04-01',
    insuredName: 'Alex Morgan',
    insuredItem: 'Term Life Insurance - 20 Year',
    coverageSummary: [
      { label: 'Death Benefit', value: '$750,000' },
      { label: 'Rider', value: 'Accelerated Benefit Rider included' },
      { label: 'Term Length', value: '20 years' },
      { label: 'Underwriting', value: 'Final review in progress' },
    ],
    billing: {
      plan: 'Draft on Activation',
      monthlyPremium: 121.5,
      nextDueDate: '2026-04-01',
      lastPaymentDate: 'Not billed yet',
      autopayEnabled: true,
    },
    documents: [
      { id: 'doc-life-app', name: 'Application Summary', updatedAt: '2026-03-12' },
      { id: 'doc-life-disclosures', name: 'Disclosures and Notices', updatedAt: '2026-03-12' },
    ],
    claimsPlaceholder:
      'Beneficiary and claim submission capabilities will appear here once life claims services are integrated.',
  },
];
