import type { Customer } from '@/types/customer';

export type DemoCompanyRow = {
  label: string;
  value: string;
};

export type DemoCompanyGroup = {
  id: string;
  title: string;
  rows: DemoCompanyRow[];
};

export type DemoCompanyData = {
  licenseNumber: string;
  cslbUrl: string | null;
  companyLookupNotice: string | null;
  businessName: string | null;
  businessRows: DemoCompanyRow[];
  licenseRows: DemoCompanyRow[];
  statusChips: Array<'Active' | 'Needs Attention'>;
  statusFallbackText: 'Active' | 'Needs Attention';
  classifications: string[];
  bonding: DemoCompanyGroup[];
  workersCompRows: DemoCompanyRow[];
  personnel: DemoCompanyGroup[];
};

export type DemoProfileUi = {
  disableExternalActions: boolean;
  disableRequestEmails: boolean;
  disabledMessage: string;
};

export type DemoProfile = {
  id: string;
  label: string;
  customer: Customer;
  agent: {
    name: string;
    phone: string | null;
    email: string | null;
    smsPhone: string | null;
    mailingAddress: string | null;
    scheduleUrl: string | null;
  };
  company: DemoCompanyData;
  ui: DemoProfileUi;
};
