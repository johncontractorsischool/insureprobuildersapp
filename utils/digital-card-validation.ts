import type { Customer } from '@/types/customer';
import type { DigitalCardDraft, DigitalCardValidationResult } from '@/types/digital-card';
import { getDigitalCardPrimaryColor, normalizeHexColor } from '@/utils/digital-card-branding';
import { normalizeDigitalCardInsuranceSummary } from '@/utils/digital-card-insurance';
import { normalizeWebsiteUrl } from '@/utils/digital-card-links';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BIO_LENGTH = 240;

function trimmed(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function buildFullName(customer: Customer | null) {
  const existing = trimmed(customer?.fullName);
  if (existing) return existing;
  return [customer?.firstName, customer?.lastName].map(trimmed).filter(Boolean).join(' ');
}

function buildServiceArea(customer: Customer | null) {
  return [customer?.city, customer?.stateNameOrAbbreviation].map(trimmed).filter(Boolean).join(', ');
}

export function getDigitalCardOwnerId(customer: Customer | null, userEmail: string | null) {
  return (
    trimmed(customer?.databaseId) ||
    trimmed(customer?.customerId) ||
    trimmed(customer?.insuredId) ||
    trimmed(userEmail).toLowerCase() ||
    'anonymous'
  );
}

export function buildInitialDigitalCardDraft(customer: Customer | null, userEmail: string | null): DigitalCardDraft {
  return {
    slug: '',
    templateId: 'insurepro-classic',
    status: 'draft',
    localImageUri: null,
    imageUrl: null,
    fullName: buildFullName(customer),
    title: '',
    company: trimmed(customer?.commercialName),
    phone: trimmed(customer?.cellPhone) || trimmed(customer?.phone),
    email: trimmed(customer?.email) || trimmed(userEmail).toLowerCase(),
    website: trimmed(customer?.website),
    bio: '',
    serviceArea: buildServiceArea(customer),
    primaryAction: 'quote',
    primaryColor: getDigitalCardPrimaryColor(null),
    cslbLicenseNumber: '',
    licenseClassification: '',
    insuranceSummary: [],
  };
}

export function normalizeDigitalCardDraft(draft: DigitalCardDraft): DigitalCardDraft {
  return {
    ...draft,
    slug: trimmed(draft.slug),
    templateId: 'insurepro-classic',
    status: draft.status === 'published' ? 'published' : 'draft',
    localImageUri: draft.localImageUri,
    imageUrl: draft.imageUrl,
    fullName: trimmed(draft.fullName),
    title: trimmed(draft.title),
    company: trimmed(draft.company),
    phone: trimmed(draft.phone),
    email: trimmed(draft.email).toLowerCase(),
    website: normalizeWebsiteUrl(draft.website),
    bio: trimmed(draft.bio),
    serviceArea: trimmed(draft.serviceArea),
    primaryAction: draft.primaryAction,
    primaryColor: getDigitalCardPrimaryColor(draft.primaryColor),
    cslbLicenseNumber: trimmed(draft.cslbLicenseNumber),
    licenseClassification: trimmed(draft.licenseClassification),
    insuranceSummary: normalizeDigitalCardInsuranceSummary(draft.insuranceSummary),
  };
}

export function validateDigitalCardDraft(draft: DigitalCardDraft): DigitalCardValidationResult {
  const normalized = normalizeDigitalCardDraft(draft);
  const fieldErrors: DigitalCardValidationResult['fieldErrors'] = {};

  if (!normalized.fullName) {
    fieldErrors.fullName = 'Full name is required.';
  }

  if (!normalized.company) {
    fieldErrors.company = 'Company name is required.';
  }

  if (!normalized.phone && !normalized.email) {
    fieldErrors.phone = 'Add a phone number or email address.';
    fieldErrors.email = 'Add an email address or phone number.';
  }

  if (normalized.email && !EMAIL_PATTERN.test(normalized.email)) {
    fieldErrors.email = 'Enter a valid email address.';
  }

  if (draft.website.trim() && !normalized.website) {
    fieldErrors.website = 'Enter a valid HTTPS website.';
  }

  if (normalized.bio.length > MAX_BIO_LENGTH) {
    fieldErrors.bio = `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`;
  }

  if (draft.primaryColor.trim() && !normalizeHexColor(draft.primaryColor)) {
    fieldErrors.primaryColor = 'Enter a six-digit hex color, such as #0B5B47.';
  }

  const isValid = Object.keys(fieldErrors).length === 0;

  return {
    draft: normalized,
    fieldErrors,
    summaryError: isValid ? null : 'Review the highlighted fields before publishing your card.',
    isValid,
  };
}

export function getDigitalCardBioCharactersRemaining(value: string) {
  return MAX_BIO_LENGTH - value.length;
}
