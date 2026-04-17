import type { DemoProfile } from '@/data/demo-profiles/types';

export const marketingDemoProfile: DemoProfile = {
  id: 'marketing',
  label: 'Marketing Demo',
  customer: {
    databaseId: 'demo-insured-db-urbanedge',
    commercialName: 'UrbanEdge Construction Inc.',
    firstName: 'Daniel',
    lastName: 'Reyes',
    fullName: 'Daniel Reyes',
    email: 'demo@insureprobuilders.com',
    phone: '916-555-0148',
    cellPhone: '916-555-0189',
    customerId: 'DEMO-1001',
    insuredId: '101000937',
    active: true,
    addressLine1: '2865 Sunrise Blvd Ste 110',
    city: 'Rancho Cordova',
    stateNameOrAbbreviation: 'CA',
    zipCode: '95742',
  },
  agent: {
    name: 'Emily Carter',
    phone: '916-555-0123',
    email: 'emily.carter@insureprobuilders.com',
    smsPhone: '916-555-0188',
    mailingAddress: '2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742',
    scheduleUrl: null,
  },
  company: {
    licenseNumber: '101000937',
    cslbUrl:
      'https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=101000937',
    companyLookupNotice: 'Marketing demo profile is active. Live CSLB data is disabled.',
    businessName: 'UrbanEdge Construction Inc.',
    businessRows: [
      { label: 'DBA', value: 'UrbanEdge Builders' },
      { label: 'Street', value: '2865 Sunrise Blvd Ste 110' },
      { label: 'City/State/ZIP', value: 'Rancho Cordova, CA 95742' },
      { label: 'Phone', value: '916-555-0148' },
      { label: 'Entity', value: 'Corporation' },
    ],
    licenseRows: [
      { label: 'License #', value: '101000937' },
      { label: 'Status', value: 'Active' },
      { label: 'Effective Date', value: 'Jan 15, 2021' },
      { label: 'Expiration Date', value: 'Jan 31, 2027' },
      { label: 'Data Current', value: 'Apr 17, 2026' },
    ],
    statusChips: ['Active'],
    statusFallbackText: 'Active',
    classifications: [
      'B - General Building Contractor',
      'C-10 - Electrical',
      'C-36 - Plumbing',
    ],
    bonding: [
      {
        id: 'contractor-bond',
        title: 'Contractor Bond',
        rows: [
          { label: 'Carrier', value: 'Surety One Insurance Company' },
          { label: 'Bond #', value: 'CB-4471102' },
          { label: 'Amount', value: '$25,000' },
          { label: 'Effective Date', value: 'Jan 1, 2026' },
          { label: 'Expiration Date', value: 'Jan 1, 2027' },
        ],
      },
      {
        id: 'permit-bond',
        title: 'Permit Bond',
        rows: [
          { label: 'Carrier', value: 'Builders Specialty Surety' },
          { label: 'Bond #', value: 'PB-882319' },
          { label: 'Amount', value: '$15,000' },
          { label: 'Effective Date', value: 'Feb 1, 2026' },
          { label: 'Expiration Date', value: 'Feb 1, 2027' },
        ],
      },
    ],
    workersCompRows: [
      { label: 'Carrier', value: 'State Compensation Insurance Fund' },
      { label: 'Policy #', value: 'WC-990281' },
      { label: 'Effective Date', value: 'Jan 1, 2026' },
      { label: 'Expiration Date', value: 'Jan 1, 2027' },
    ],
    personnel: [
      {
        id: 'person-1',
        title: 'Daniel Reyes',
        rows: [
          { label: 'Title', value: 'President' },
          { label: 'Associated', value: 'Jan 15, 2021' },
          { label: 'Classification', value: 'Responsible Managing Officer' },
        ],
      },
      {
        id: 'person-2',
        title: 'Morgan Lee',
        rows: [
          { label: 'Title', value: 'Secretary' },
          { label: 'Associated', value: 'Jan 15, 2021' },
          { label: 'Classification', value: 'Officer' },
        ],
      },
    ],
  },
  ui: {
    disableExternalActions: true,
    disableRequestEmails: true,
    disabledMessage: 'This action is disabled while the marketing demo profile is active.',
  },
};
