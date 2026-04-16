import type { PbiaFormSlug, PbiaQueryParams } from '@/constants/pbia-forms';
import type { CslbLicense } from '@/services/cslb-api';
import type { Customer } from '@/types/customer';
import type { Policy } from '@/types/policy';
import { getNameFromCustomer } from '@/utils/format';

type PbiaFormPrefillContext = {
  customer: Customer | null;
  userEmail: string | null;
  policy?: Policy | null;
  cslbLicense?: CslbLicense | null;
  fallbackLicenseNumber?: string | null;
};

type ContactProfile = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
};

type BusinessProfile = {
  businessName: string | null;
  dba: string | null;
  entity: string | null;
  licenseNumber: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  cityStateZip: string | null;
  phone: string | null;
  website: string | null;
  fein: string | null;
  description: string | null;
  classifications: string[];
  firstClassification: string | null;
  classificationsText: string | null;
};

type AddressParts = {
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

const LLC_PATTERNS = [
  /\bl\.?\s*l\.?\s*c\.?\b/i,
  /limited liability company/i,
  /limited liability co/i,
  /ltd liability/i,
] as const;

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizePhone(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return normalized;
}

function normalizeEntity(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (LLC_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'LLC';
  }

  return normalized;
}

function parseCityStateZip(value: string | null | undefined): AddressParts {
  const normalized = normalizeText(value);
  if (!normalized) {
    return {
      city: null,
      state: null,
      zipCode: null,
    };
  }

  const withCommaMatch = normalized.match(/^(.*?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (withCommaMatch) {
    return {
      city: normalizeText(withCommaMatch[1]),
      state: withCommaMatch[2].toUpperCase(),
      zipCode: withCommaMatch[3],
    };
  }

  const withoutCommaMatch = normalized.match(/^(.*?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (withoutCommaMatch) {
    return {
      city: normalizeText(withoutCommaMatch[1]),
      state: withoutCommaMatch[2].toUpperCase(),
      zipCode: withoutCommaMatch[3],
    };
  }

  return {
    city: null,
    state: null,
    zipCode: null,
  };
}

function resolveContactProfile(customer: Customer | null, userEmail: string | null): ContactProfile {
  const fullName =
    normalizeText(customer?.fullName) ??
    normalizeText(getNameFromCustomer(customer, userEmail)) ??
    null;

  return {
    fullName,
    firstName: normalizeText(customer?.firstName),
    lastName: normalizeText(customer?.lastName),
    email: normalizeEmail(customer?.email ?? userEmail),
    phone: normalizePhone(customer?.phone ?? customer?.cellPhone ?? customer?.smsPhone),
    mobilePhone: normalizePhone(customer?.cellPhone ?? customer?.smsPhone ?? customer?.phone),
  };
}

function resolveBusinessProfile(
  customer: Customer | null,
  cslbLicense: CslbLicense | null | undefined,
  fallbackLicenseNumber: string | null | undefined
): BusinessProfile {
  const parsedBusinessAddress = parseCityStateZip(cslbLicense?.business.cityStateZip);
  const classifications = (cslbLicense?.classifications ?? [])
    .map((classification) => normalizeText(classification))
    .filter((classification): classification is string => Boolean(classification));

  const city = normalizeText(customer?.city) ?? parsedBusinessAddress.city;
  const state =
    normalizeText(customer?.stateNameOrAbbreviation)?.toUpperCase() ?? parsedBusinessAddress.state;
  const zipCode = normalizeText(customer?.zipCode) ?? parsedBusinessAddress.zipCode;

  return {
    businessName:
      normalizeText(cslbLicense?.business.businessName) ?? normalizeText(customer?.commercialName),
    dba: normalizeText(cslbLicense?.business.dba),
    entity: normalizeEntity(cslbLicense?.entity),
    licenseNumber:
      normalizeText(cslbLicense?.licenseNumber) ??
      normalizeText(customer?.insuredId) ??
      normalizeText(fallbackLicenseNumber),
    street: normalizeText(customer?.addressLine1) ?? normalizeText(cslbLicense?.business.street),
    city,
    state,
    zipCode,
    cityStateZip:
      [city, state, zipCode].filter(Boolean).join(', ').replace(/, ([A-Z]{2}), /, ', $1 ') ||
      normalizeText(cslbLicense?.business.cityStateZip),
    phone:
      normalizePhone(cslbLicense?.business.phone) ??
      normalizePhone(customer?.phone) ??
      normalizePhone(customer?.cellPhone) ??
      normalizePhone(customer?.smsPhone),
    website: normalizeText(customer?.website),
    fein: normalizeText(customer?.fein),
    description: normalizeText(customer?.description),
    classifications,
    firstClassification: classifications[0] ?? null,
    classificationsText: classifications.length > 0 ? classifications.join(', ') : null,
  };
}

function resolvePolicyNumber(policy: Policy | null | undefined) {
  return normalizeText(policy?.policyNumber);
}

function buildContactPrefill(contact: ContactProfile): PbiaQueryParams {
  return {
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
  };
}

export function buildPbiaFormPrefillParams(
  slug: PbiaFormSlug,
  {
    customer,
    userEmail,
    policy,
    cslbLicense,
    fallbackLicenseNumber,
  }: PbiaFormPrefillContext
): PbiaQueryParams {
  const contact = resolveContactProfile(customer, userEmail);
  const business = resolveBusinessProfile(customer, cslbLicense, fallbackLicenseNumber);
  const activePolicyNumber = resolvePolicyNumber(policy);
  const policyType = normalizeText(policy?.productName);

  switch (slug) {
    case 'contact':
      return {
        ...buildContactPrefill(contact),
      };

    case 'quick-quote':
      return {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        policyType,
      };

    case 'bond-quote':
      return {
        licenseNumber: business.licenseNumber,
        businessName: business.businessName,
        dba: business.dba,
        entity: business.entity,
        address: business.street,
        city: business.city,
        state: business.state,
        zip: business.zipCode,
        phone: business.phone,
        classifications: business.classificationsText,
        indemnitorFirstName: contact.firstName,
        indemnitorLastName: contact.lastName,
        indemnitorEmail: contact.email,
        indemnitorEmailConfirm: contact.email,
        indemnitorPhone: contact.mobilePhone ?? contact.phone,
      };

    case 'bond-request':
      return {
        principalFirstName: contact.firstName,
        principalLastName: contact.lastName,
      };

    case 'builder-risk-quote-request':
      return {
        applicantName: business.businessName ?? contact.fullName,
        dba: business.dba,
        streetAddress: business.street,
        city: business.city,
        state: business.state,
        zipCode: business.zipCode,
      };

    case 'additional-insured-request':
      return {
        licenseNumber: business.licenseNumber,
        email: contact.email,
        policyNumber: activePolicyNumber,
      };

    case 'commercial-auto':
      return {
        lookupLicense: business.licenseNumber,
        'general[classification]': business.firstClassification ?? business.classificationsText,
        'general[businessName]': business.businessName,
        'general[contractorLicense]': business.licenseNumber,
        'general[phoneNumber]': business.phone,
        'general[street]': business.street,
        'general[city]': business.city,
        'general[state]': business.state,
        'general[zip]': business.zipCode,
        'general[email]': contact.email,
        'general[federalTaxId]': business.fein,
        'general[website]': business.website,
        'general[businessDescription]': business.description,
        'contact[firstName]': contact.firstName,
        'contact[lastName]': contact.lastName,
        'contact[email]': contact.email,
        'contact[phoneNumber]': contact.phone,
        'business[email]': contact.email,
        'business[website]': business.website,
      };

    case 'inland-marine-intake':
      return {
        applicantFirstName: contact.firstName,
        applicantLastName: contact.lastName,
        email: contact.email,
        phoneNumber: contact.phone,
        dba: business.dba,
        typeOfBusiness: business.firstClassification ?? business.entity,
        businessStreetAddress: business.street,
        businessCity: business.city,
        businessState: business.state,
        businessZipCode: business.zipCode,
        inspectionContactFirstName: contact.firstName,
        inspectionContactLastName: contact.lastName,
        inspectionContactEmail: contact.email,
        inspectionContactPhone: contact.phone,
      };

    case 'pollution-liability-intake':
      return {
        applicantName: contact.fullName,
        businessName: business.businessName,
        dba: business.dba,
        businessStreetAddress: business.street,
        businessCity: business.city,
        businessState: business.state,
        businessZipCode: business.zipCode,
        classCode: business.firstClassification,
      };

    case 'professional-liability-quote-request':
      return {
        customerFullName: contact.fullName,
        customerOccupation: business.firstClassification,
        businessStreetAddress: business.street,
        businessCity: business.city,
        businessState: business.state,
        businessZipCode: business.zipCode,
      };

    case 'total-net-worth':
      return {
        contactName: contact.fullName,
        companyName: business.businessName,
        companyAddressLineOne: business.street,
        companyCityStateZip: business.cityStateZip,
        stateLicenseNumber: business.licenseNumber,
        organizationType: business.entity,
        businessPhone: business.phone,
        emailAddress: contact.email,
      };

    case 'workers-comp':
      return {
        lookupLicense: business.licenseNumber,
        businessClassifications: business.classificationsText,
        businessName: business.businessName,
        businessStreet: business.street,
        businessCity: business.city,
        businessState: business.state,
        businessZip: business.zipCode,
        licenseNumber: business.licenseNumber,
        fein: business.fein,
        phoneNumber: business.phone,
        email: contact.email,
        website: business.website,
        operationsDescription: business.description,
      };

    case 'general-liability':
      return {
        lookupLicense: business.licenseNumber,
        license: business.licenseNumber,
        'business[classification]': business.firstClassification ?? business.classificationsText,
        'business[name]': business.businessName,
        'business[license]': business.licenseNumber,
        'business[street]': business.street,
        'business[city]': business.city,
        'business[state]': business.state,
        'business[zip]': business.zipCode,
        'business[fein]': business.fein,
        'business[phone]': business.phone,
        'business[email]': contact.email,
        'business[website]': business.website,
        'business[operationsDescription]': business.description,
      };
  }
}
