import { buildDigitalCardPublicUrl, normalizeWebsiteUrl } from '@/utils/digital-card-links';
import {
  getAccessibleForegroundColor,
  getDigitalCardPrimaryColor,
  normalizeHexColor,
} from '@/utils/digital-card-branding';
import {
  buildDigitalCardInsuranceSummary,
  normalizeDigitalCardInsuranceSummary,
} from '@/utils/digital-card-insurance';
import {
  buildInitialDigitalCardDraft,
  getDigitalCardOwnerId,
  validateDigitalCardDraft,
} from '@/utils/digital-card-validation';
import { buildPolicy } from '@/tests/factories';

describe('digital card prefill', () => {
  it('prefills from the selected customer with fallback contact values', () => {
    const draft = buildInitialDigitalCardDraft(
      {
        databaseId: 'customer-1',
        firstName: 'Jane',
        lastName: 'Builder',
        commercialName: 'Acme Builders',
        phone: '555-1000',
        cellPhone: '555-2000',
        email: null,
        city: 'Fresno',
        stateNameOrAbbreviation: 'CA',
        website: 'acme.example',
      },
      'jane@example.com'
    );

    expect(draft.fullName).toBe('Jane Builder');
    expect(draft.company).toBe('Acme Builders');
    expect(draft.phone).toBe('555-2000');
    expect(draft.email).toBe('jane@example.com');
    expect(draft.serviceArea).toBe('Fresno, CA');
    expect(draft.primaryColor).toBe('#0B5B47');
    expect(draft.insuranceSummary).toEqual([]);
  });

  it('uses stable account identifiers for draft isolation', () => {
    expect(getDigitalCardOwnerId({ databaseId: 'db-1' }, 'owner@example.com')).toBe('db-1');
    expect(getDigitalCardOwnerId({ insuredId: 'INS-1' }, 'owner@example.com')).toBe('INS-1');
    expect(getDigitalCardOwnerId(null, 'Owner@Example.com')).toBe('owner@example.com');
  });
});

describe('digital card validation', () => {
  it('requires identity and at least one valid contact method', () => {
    const result = validateDigitalCardDraft({
      slug: '',
      templateId: 'insurepro-classic',
      status: 'draft',
      localImageUri: null,
      imageUrl: null,
      fullName: '',
      title: '',
      company: '',
      phone: '',
      email: 'bad-email',
      website: 'http://example.com',
      bio: 'x'.repeat(241),
      serviceArea: '',
      primaryAction: 'quote',
      primaryColor: 'not-a-color',
      cslbLicenseNumber: '',
      licenseClassification: '',
      insuranceSummary: [],
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.fullName).toBeTruthy();
    expect(result.fieldErrors.company).toBeTruthy();
    expect(result.fieldErrors.email).toBeTruthy();
    expect(result.fieldErrors.website).toBeTruthy();
    expect(result.fieldErrors.bio).toBeTruthy();
    expect(result.fieldErrors.primaryColor).toBeTruthy();
  });

  it('normalizes optional website values to HTTPS URLs', () => {
    expect(normalizeWebsiteUrl('example.com/path')).toBe('https://example.com/path');
    expect(normalizeWebsiteUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeWebsiteUrl('http://example.com')).toBe('');
  });

  it('builds public card URLs from the configured origin', () => {
    process.env.EXPO_PUBLIC_DIGITAL_CARD_BASE_URL = 'https://cards.example.com/';
    expect(buildDigitalCardPublicUrl('acme-a1b2')).toBe('https://cards.example.com/card/acme-a1b2');
  });
});

describe('digital card insurance summary', () => {
  it('summarizes only active policy lines for public display', () => {
    expect(
      buildDigitalCardInsuranceSummary([
        buildPolicy({ productName: 'General Liability', status: 'Active' }),
        buildPolicy({ id: 'policy-2', productName: 'Workers Compensation', status: 'Active' }),
        buildPolicy({ id: 'policy-3', productName: 'Commercial Auto', status: 'Pending' }),
      ])
    ).toEqual([
      { label: 'General Liability', detail: 'Active policy on file' },
      { label: 'Workers Compensation', detail: 'Active policy on file' },
    ]);
  });

  it('deduplicates active policy lines and normalizes persisted summaries', () => {
    expect(
      buildDigitalCardInsuranceSummary([
        buildPolicy({ productName: 'GL', status: 'Active' }),
        buildPolicy({ id: 'policy-2', productName: 'General Liability', status: 'Active' }),
      ])
    ).toEqual([{ label: 'General Liability', detail: 'Active policy on file' }]);

    expect(
      normalizeDigitalCardInsuranceSummary([
        { label: ' General Liability ', detail: ' Active policy on file ' },
        { label: '', detail: 'Missing label' },
      ])
    ).toEqual([{ label: 'General Liability', detail: 'Active policy on file' }]);
  });
});

describe('digital card branding', () => {
  it('normalizes six-digit hex colors and rejects invalid values', () => {
    expect(normalizeHexColor('0b5b47')).toBe('#0B5B47');
    expect(normalizeHexColor('#ffffff')).toBe('#FFFFFF');
    expect(normalizeHexColor('#fff')).toBe('');
  });

  it('falls back to the default brand color', () => {
    expect(getDigitalCardPrimaryColor('')).toBe('#0B5B47');
    expect(getDigitalCardPrimaryColor('bad')).toBe('#0B5B47');
  });

  it('chooses readable foreground colors for light and dark brand colors', () => {
    expect(getAccessibleForegroundColor('#0B5B47')).toBe('#FFFFFF');
    expect(getAccessibleForegroundColor('#F2F7EF')).toBe('#151B18');
  });
});
