import {
  buildCslbMomentumSyncRequest,
  normalizeCslbMomentumSyncForm,
  validateCslbMomentumSyncForm,
} from '@/hooks/use-cslb-momentum-sync';

describe('useCslbMomentumSync validation utilities', () => {
  it('requires first name, last name, email, and one identifier', () => {
    const errors = validateCslbMomentumSyncForm({
      firstName: '',
      lastName: '',
      email: '',
      licenseNumber: '',
      appFeeNumber: '',
      agentName: '',
    });

    expect(errors.firstName).toBe('First name is required.');
    expect(errors.lastName).toBe('Last name is required.');
    expect(errors.email).toBe('Email is required.');
    expect(errors.licenseNumber).toBe('Enter a license number or app fee number.');
    expect(errors.appFeeNumber).toBe('Enter a license number or app fee number.');
  });

  it('accepts app fee number without license number', () => {
    const errors = validateCslbMomentumSyncForm({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      licenseNumber: '',
      appFeeNumber: 'APP-101',
      agentName: '',
    });

    expect(errors).toEqual({});
  });

  it('normalizes trimmed values and lowercases email', () => {
    const normalized = normalizeCslbMomentumSyncForm({
      firstName: '  John ',
      lastName: ' Doe  ',
      email: '  JOHN@EXAMPLE.COM  ',
      licenseNumber: ' 1105382 ',
      appFeeNumber: ' APP-100 ',
      agentName: '  John McCants ',
    });

    expect(normalized).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      licenseNumber: '1105382',
      appFeeNumber: 'APP-100',
      agentName: 'John McCants',
    });
  });

  it('uses app fee number precedence when both identifiers are provided', () => {
    const request = buildCslbMomentumSyncRequest({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      licenseNumber: '1105382',
      appFeeNumber: 'APP-100',
      agentName: 'John McCants',
    });

    expect(request).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      licenseNumber: '',
      appFeeNumber: 'APP-100',
      agentName: 'John McCants',
    });
  });
});
