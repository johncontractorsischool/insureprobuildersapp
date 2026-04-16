import { buildCslbLicenseUrl, fetchCslbLicenseByInsuredId } from '@/services/cslb-api';

describe('cslb api', () => {
  it('builds a fallback CSLB URL from the insured id', () => {
    expect(buildCslbLicenseUrl(' LIC-123 ')).toBe('https://www.cslb.ca.gov/LIC-123');
  });

  it('maps CSLB payloads into the app license model', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        licenseNumber: 'LIC-123456',
        dataCurrentAsOf: 'Mar 1, 2026',
        business: {
          businessName: 'Builder Co',
          dba: 'Builder DBA',
          street: '123 Main St',
          cityStateZip: 'Los Angeles, CA 90001',
          phone: '5551112222',
        },
        entity: 'Corporation',
        issueDate: 'Jan 1, 2020',
        expireDate: 'Jan 1, 2027',
        status: 'Active and current',
        classifications: ['B - General Building Contractor'],
        bonding: [
          {
            bondType: 'Contractor Bond',
            carrierName: 'Surety Co',
            bondNumber: 'B123',
            bondAmount: '$25,000',
            effectiveDate: 'Jan 1, 2026',
            expirationDate: 'Jan 1, 2027',
          },
        ],
        workersComp: {
          carrierName: 'WC Carrier',
          policyNumber: 'WC123',
          effectiveDate: 'Jan 1, 2026',
          expireDate: 'Jan 1, 2027',
          status: 'Exempt',
          exemption: 'No employees',
          exception: 'Limited Liability Company',
          notes: 'Coverage not required',
        },
        personnel: [
          {
            name: 'Jane Builder',
            title: 'Officer',
            associationDate: 'Jan 1, 2020',
            classification: 'Responsible Managing Officer',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const license = await fetchCslbLicenseByInsuredId('LIC-123456');

    expect(license).toEqual(
      expect.objectContaining({
        sourceUrl: 'https://www.cslb.ca.gov/LIC-123456',
        licenseNumber: 'LIC-123456',
        status: 'Active and current',
        classifications: ['B - General Building Contractor'],
        business: expect.objectContaining({
          businessName: 'Builder Co',
        }),
        bonding: [
          expect.objectContaining({
            bondType: 'Contractor Bond',
            carrierName: 'Surety Co',
          }),
        ],
        workersComp: expect.objectContaining({
          status: 'Exempt',
          exemption: 'No employees',
          exception: 'Limited Liability Company',
          notes: 'Coverage not required',
        }),
      })
    );
  });
});
