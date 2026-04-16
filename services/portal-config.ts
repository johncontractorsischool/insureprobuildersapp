type PortalConfig = {
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

function normalizeHttpUrl(value: string | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (!/^https?:\/\//i.test(normalized)) {
    return null;
  }

  return normalized;
}

export function getPortalConfig(): PortalConfig {
  return {
    agent: {
      name: normalizeText(process.env.EXPO_PUBLIC_AGENT_NAME) ?? 'Assigned agent',
      phone: normalizeText(process.env.EXPO_PUBLIC_AGENT_PHONE),
      email: normalizeText(process.env.EXPO_PUBLIC_AGENT_EMAIL),
      smsPhone: normalizeText(process.env.EXPO_PUBLIC_AGENT_SMS_PHONE),
      mailingAddress:
        normalizeText(process.env.EXPO_PUBLIC_AGENCY_MAILING_ADDRESS) ??
        '2865 Sunrise Blvd Ste 110, Rancho Cordova, CA 95742',
      scheduleUrl: normalizeHttpUrl(process.env.EXPO_PUBLIC_AGENT_SCHEDULE_URL),
    },
    company: {
      licenseNumber: normalizeText(process.env.EXPO_PUBLIC_COMPANY_LICENSE_NUMBER),
      cslbUrl: normalizeHttpUrl(process.env.EXPO_PUBLIC_COMPANY_CSLB_URL),
    },
    actions: {
      intakeFormsUrl: normalizeHttpUrl(process.env.EXPO_PUBLIC_INTAKE_FORMS_URL),
      issueCoiUrl: normalizeHttpUrl(process.env.EXPO_PUBLIC_ISSUE_COI_URL),
      supportEmail: normalizeText(process.env.EXPO_PUBLIC_SUPPORT_EMAIL) ?? 'support@insureprobuilders.com',
    },
  };
}

export type { PortalConfig };
