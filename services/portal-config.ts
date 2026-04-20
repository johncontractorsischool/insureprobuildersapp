import { DEFAULT_DEMO_PROFILE_ID, getDemoProfileById } from '@/data/demo-profiles';
import type { DemoProfile } from '@/data/demo-profiles';

type PortalConfig = {
  demo: {
    enabled: boolean;
    profile: string | null;
    data: DemoProfile | null;
  };
  review: {
    enabled: boolean;
    email: string | null;
    code: string | null;
  };
  agent: {
    name: string;
    phone: string | null;
    email: string | null;
    smsPhone: string | null;
    mailingAddress: string | null;
    scheduleUrl: string | null;
  };
  company: {
    licenseNumber: string | null;
    cslbUrl: string | null;
  };
  actions: {
    intakeFormsUrl: string | null;
    issueCoiUrl: string | null;
    supportEmail: string;
  };
};

function normalizeText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value: string | undefined) {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeBooleanFlag(value: string | undefined) {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function normalizeHttpUrl(value: string | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (!/^https?:\/\//i.test(normalized)) {
    return null;
  }

  return normalized;
}

export function getPortalConfig(): PortalConfig {
  const isDemoModeEnabled = normalizeBooleanFlag(process.env.EXPO_PUBLIC_DEMO_ACCOUNT);
  const isAppleReviewModeEnabled = normalizeBooleanFlag(process.env.EXPO_PUBLIC_APPLE_REVIEW_DEMO_LOGIN);
  const requestedDemoProfile = normalizeText(process.env.EXPO_PUBLIC_DEMO_PROFILE);
  const demoProfile = isDemoModeEnabled ? getDemoProfileById(requestedDemoProfile ?? DEFAULT_DEMO_PROFILE_ID) : null;
  const appleReviewEmail =
    normalizeEmail(process.env.EXPO_PUBLIC_APPLE_REVIEW_EMAIL) ?? 'demo@insureprobuilders.com';
  const appleReviewCode = normalizeText(process.env.EXPO_PUBLIC_APPLE_REVIEW_CODE) ?? '111111';

  return {
    demo: {
      enabled: Boolean(demoProfile),
      profile: demoProfile?.id ?? requestedDemoProfile,
      data: demoProfile,
    },
    review: {
      enabled: isAppleReviewModeEnabled,
      email: isAppleReviewModeEnabled ? appleReviewEmail : null,
      code: isAppleReviewModeEnabled ? appleReviewCode : null,
    },
    agent: {
      name: demoProfile?.agent.name ?? normalizeText(process.env.EXPO_PUBLIC_AGENT_NAME) ?? 'Assigned agent',
      phone: demoProfile?.agent.phone ?? normalizeText(process.env.EXPO_PUBLIC_AGENT_PHONE),
      email: demoProfile?.agent.email ?? normalizeText(process.env.EXPO_PUBLIC_AGENT_EMAIL),
      smsPhone: demoProfile?.agent.smsPhone ?? normalizeText(process.env.EXPO_PUBLIC_AGENT_SMS_PHONE),
      mailingAddress:
        demoProfile?.agent.mailingAddress ??
        normalizeText(process.env.EXPO_PUBLIC_AGENCY_MAILING_ADDRESS) ??
        '2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742',
      scheduleUrl: demoProfile?.agent.scheduleUrl ?? normalizeHttpUrl(process.env.EXPO_PUBLIC_AGENT_SCHEDULE_URL),
    },
    company: {
      licenseNumber: demoProfile?.company.licenseNumber ?? normalizeText(process.env.EXPO_PUBLIC_COMPANY_LICENSE_NUMBER),
      cslbUrl: demoProfile?.company.cslbUrl ?? normalizeHttpUrl(process.env.EXPO_PUBLIC_COMPANY_CSLB_URL),
    },
    actions: {
      intakeFormsUrl: normalizeHttpUrl(process.env.EXPO_PUBLIC_INTAKE_FORMS_URL),
      issueCoiUrl: normalizeHttpUrl(process.env.EXPO_PUBLIC_ISSUE_COI_URL),
      supportEmail: normalizeText(process.env.EXPO_PUBLIC_SUPPORT_EMAIL) ?? 'support@insureprobuilders.com',
    },
  };
}

export type { PortalConfig };
