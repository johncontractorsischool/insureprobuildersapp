const DEFAULT_PBIA_BASE_URL = 'https://www.pbia.com';

export type PbiaFormRegistryItem = {
  slug: string;
  title: string;
  path: string;
  description?: string;
};

function normalizeBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolvePbiaUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${PBIA_BASE_URL}${normalizedPath}`;
}

function withInstanceId(url: string, instanceId?: string) {
  if (!instanceId) return url;

  const resolved = new URL(url);
  resolved.searchParams.set('instanceId', instanceId);
  return resolved.toString();
}

export const PBIA_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_PBIA_BASE_URL?.trim() || DEFAULT_PBIA_BASE_URL
);

export const PBIA_FORM_REGISTRY: PbiaFormRegistryItem[] = [
  {
    slug: 'certificate-request',
    title: 'Certificate Request',
    path: '/certificate-request',
    description: 'Request an updated certificate of insurance.',
  },
  {
    slug: 'endorsement-request',
    title: 'Endorsement Request',
    path: '/endorsement-request',
    description: 'Submit a policy endorsement or change request.',
  },
  {
    slug: 'policy-service-request',
    title: 'Policy Service Request',
    path: '/policy-service-request',
    description: 'Send a general servicing request to your policy team.',
  },
];

export function findPbiaFormBySlug(slug?: string | null) {
  if (!slug) return null;
  return PBIA_FORM_REGISTRY.find((form) => form.slug === slug) ?? null;
}

export function createPbiaInstanceId() {
  return `pbia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPbiaFormUrl(form: PbiaFormRegistryItem, instanceId?: string) {
  return withInstanceId(resolvePbiaUrl(form.path), instanceId);
}

export function buildPbiaEmbeddedUrl(target: string, instanceId: string) {
  return withInstanceId(resolvePbiaUrl(target), instanceId);
}
