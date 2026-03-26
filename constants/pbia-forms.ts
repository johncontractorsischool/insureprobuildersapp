export const PBIA_BASE_URL = 'https://pbia-form-app.vercel.app';

export const PBIA_FORM_SLUGS = [
  'commercial-auto',
  'general-liability',
  'workers-comp',
  'additional-insured-request',
  'bond-quote',
  'bond-request',
  'total-net-worth',
  'inland-marine-intake',
  'pollution-liability-intake',
  'builder-risk-quote-request',
  'professional-liability-quote-request',
  'quick-quote',
  'contact',
] as const;

export type PbiaFormSlug = (typeof PBIA_FORM_SLUGS)[number];

export type PbiaFormRegistryItem = {
  slug: PbiaFormSlug;
  title: string;
  path: `/forms/${PbiaFormSlug}`;
};

export const PBIA_FORMS: readonly PbiaFormRegistryItem[] = [
  {
    slug: 'commercial-auto',
    title: 'Commercial Auto Insurance Intake',
    path: '/forms/commercial-auto',
  },
  {
    slug: 'general-liability',
    title: 'General Liability Intake',
    path: '/forms/general-liability',
  },
  {
    slug: 'workers-comp',
    title: 'Workers Compensation Intake',
    path: '/forms/workers-comp',
  },
  {
    slug: 'additional-insured-request',
    title: 'Additional Insured Request',
    path: '/forms/additional-insured-request',
  },
  {
    slug: 'bond-quote',
    title: 'Contractor Bond Quote',
    path: '/forms/bond-quote',
  },
  {
    slug: 'bond-request',
    title: 'Bond Request Form',
    path: '/forms/bond-request',
  },
  {
    slug: 'total-net-worth',
    title: 'Total Net Worth Form',
    path: '/forms/total-net-worth',
  },
  {
    slug: 'inland-marine-intake',
    title: 'Inland Marine Intake Form',
    path: '/forms/inland-marine-intake',
  },
  {
    slug: 'pollution-liability-intake',
    title: 'Pollution Liability Intake Form',
    path: '/forms/pollution-liability-intake',
  },
  {
    slug: 'builder-risk-quote-request',
    title: 'Builder Risk Quote Request Form',
    path: '/forms/builder-risk-quote-request',
  },
  {
    slug: 'professional-liability-quote-request',
    title: 'Professional Liability Quote Request Form',
    path: '/forms/professional-liability-quote-request',
  },
  {
    slug: 'quick-quote',
    title: 'Quick Quote + Callback Card',
    path: '/forms/quick-quote',
  },
  {
    slug: 'contact',
    title: 'Contact Us',
    path: '/forms/contact',
  },
] as const;

export function createPbiaInstanceId() {
  return `pbia-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPbiaFormUrl(form: PbiaFormRegistryItem, instanceId: string) {
  const url = new URL(form.path, PBIA_BASE_URL);
  url.searchParams.set('embed', 'true');
  url.searchParams.set('instance', instanceId);
  return url.toString();
}

export function buildPbiaEmbeddedUrl(target: string, instanceId: string) {
  const url = new URL(target, PBIA_BASE_URL);
  url.searchParams.set('embed', 'true');
  url.searchParams.set('instance', instanceId);
  return url.toString();
}

export function findPbiaFormBySlug(slug: string | string[] | undefined) {
  if (!slug) return undefined;
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;
  return PBIA_FORMS.find((item) => item.slug === normalizedSlug);
}
