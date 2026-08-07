import {
  buildClientSignupRequest,
  normalizeClientSignupForm,
  validateClientSignupForm,
} from '@/hooks/use-client-signup';

const validForm = {
  businessName: 'Builder Co',
  firstName: 'Jane',
  lastName: 'Builder',
  email: 'jane@example.com',
  phone: '5551112222',
  addressLine1: '123 Main St',
  addressLine2: '',
  city: 'Los Angeles',
  state: 'CA',
  zipCode: '90001',
  licenseNumber: '1144038',
  appFeeNumber: '',
};

describe('client signup validation utilities', () => {
  it('requires all fields required by the PBIA signup contract', () => {
    const errors = validateClientSignupForm({
      ...validForm,
      businessName: '',
      firstName: '',
      addressLine1: '',
      city: '',
      state: '',
      zipCode: '',
      licenseNumber: '',
    });

    expect(errors.businessName).toBe('Business name is required.');
    expect(errors.firstName).toBe('First name is required.');
    expect(errors.addressLine1).toBe('Street address is required.');
    expect(errors.licenseNumber).toBe('Enter a license number or app fee number.');
  });

  it('normalizes values and maps the PBIA request body', () => {
    const normalized = normalizeClientSignupForm({
      ...validForm,
      businessName: ' Builder Co ',
      email: ' JANE@EXAMPLE.COM ',
      state: ' ca ',
    });

    expect(buildClientSignupRequest(normalized)).toEqual({
      legalName: 'Builder Co',
      email: 'jane@example.com',
      phone: '5551112222',
      status: 'PROSPECT',
      licenseNumber: '1144038',
      primaryContactFirstName: 'Jane',
      primaryContactLastName: 'Builder',
      addressLine1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
    });
  });
});
