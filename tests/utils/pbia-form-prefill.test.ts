import { buildPbiaFormUrl } from '@/constants/pbia-forms';
import { buildCustomer, buildPolicy } from '@/tests/factories';
import { buildPbiaFormPrefillParams } from '@/utils/pbia-form-prefill';

function buildCslbLicense() {
  return {
    sourceUrl: 'https://cslb.ca.gov/license-detail',
    licenseNumber: 'LIC-123456',
    dataCurrentAsOf: 'Apr 15, 2026',
    business: {
      businessName: 'Builder Co',
      dba: 'Builder DBA',
      street: '123 Main St',
      cityStateZip: 'Los Angeles, CA 90001',
      phone: '5551112222',
    },
    entity: 'Limited Liability Company',
    issueDate: '2020-01-01',
    expireDate: '2027-01-01',
    status: 'Active',
    classifications: ['B - General Building Contractor', 'C33 - Painting and Decorating'],
    bonding: [],
    workersComp: null,
    liability: null,
    personnel: [],
  };
}

describe('buildPbiaFormPrefillParams', () => {
  it('maps contact, business, and license fields for commercial auto', () => {
    const params = buildPbiaFormPrefillParams('commercial-auto', {
      customer: buildCustomer({
        addressLine1: '123 Main St',
        city: 'Los Angeles',
        stateNameOrAbbreviation: 'CA',
        zipCode: '90001',
        website: 'https://builder.example.com',
        fein: '12-3456789',
        description: 'General contractor for commercial and residential projects.',
      }),
      userEmail: 'jane@example.com',
      cslbLicense: buildCslbLicense(),
      fallbackLicenseNumber: null,
    });

    expect(params).toEqual(
      expect.objectContaining({
        lookupLicense: 'LIC-123456',
        'general[classification]': 'B - General Building Contractor',
        'general[businessName]': 'Builder Co',
        'general[contractorLicense]': 'LIC-123456',
        'general[street]': '123 Main St',
        'general[city]': 'Los Angeles',
        'general[state]': 'CA',
        'general[zip]': '90001',
        'general[email]': 'jane@example.com',
        'general[federalTaxId]': '12-3456789',
        'contact[firstName]': 'Jane',
        'contact[lastName]': 'Builder',
        'business[website]': 'https://builder.example.com',
      })
    );
  });

  it('uses the selected policy number for additional insured requests', () => {
    const params = buildPbiaFormPrefillParams('additional-insured-request', {
      customer: buildCustomer(),
      userEmail: 'jane@example.com',
      policy: buildPolicy({ policyNumber: 'GL-1001', status: 'Active' }),
      cslbLicense: buildCslbLicense(),
      fallbackLicenseNumber: null,
    });

    expect(params).toEqual({
      licenseNumber: 'LIC-123456',
      email: 'jane@example.com',
      policyNumber: 'GL-1001',
    });
  });

  it('maps business and contact fields for general liability', () => {
    const params = buildPbiaFormPrefillParams('general-liability', {
      customer: buildCustomer({
        addressLine1: '123 Main St',
        city: 'Los Angeles',
        stateNameOrAbbreviation: 'CA',
        zipCode: '90001',
        website: 'https://builder.example.com',
        fein: '12-3456789',
        description: 'General contractor for commercial and residential projects.',
      }),
      userEmail: 'jane@example.com',
      cslbLicense: buildCslbLicense(),
      fallbackLicenseNumber: null,
    });

    expect(params).toEqual(
      expect.objectContaining({
        lookupLicense: 'LIC-123456',
        license: 'LIC-123456',
        'business[classification]': 'B - General Building Contractor',
        'business[name]': 'Builder Co',
        'business[license]': 'LIC-123456',
        'business[street]': '123 Main St',
        'business[city]': 'Los Angeles',
        'business[state]': 'CA',
        'business[zip]': '90001',
        'business[fein]': '12-3456789',
        'business[phone]': '5551112222',
        'business[email]': 'jane@example.com',
        'business[website]': 'https://builder.example.com',
        'business[operationsDescription]': 'General contractor for commercial and residential projects.',
      })
    );
  });
});

describe('buildPbiaFormUrl', () => {
  it('appends safe prefill params while preserving reserved embed metadata', () => {
    const url = buildPbiaFormUrl(
      {
        slug: 'additional-insured-request',
        title: 'Additional Insured Request',
        path: '/forms/additional-insured-request',
      },
      'instance-123',
      {
        embed: 'false',
        licenseNumber: 'LIC-123456',
        projectTypes: ['commercial', 'residential'],
      }
    );

    const parsed = new URL(url);

    expect(parsed.searchParams.get('embed')).toBe('true');
    expect(parsed.searchParams.get('instance')).toBe('instance-123');
    expect(parsed.searchParams.get('licenseNumber')).toBe('LIC-123456');
    expect(parsed.searchParams.getAll('projectTypes')).toEqual(['commercial', 'residential']);
  });
});
