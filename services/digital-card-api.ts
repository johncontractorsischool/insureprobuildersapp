import { getSupabaseClient } from '@/services/supabase';
import type {
  DigitalBusinessCard,
  DigitalCardInsuranceSummary,
  DigitalCardDraft,
  DigitalCardPrimaryAction,
  DigitalCardStatus,
} from '@/types/digital-card';
import { getDigitalCardPrimaryColor } from '@/utils/digital-card-branding';
import { normalizeDigitalCardInsuranceSummary } from '@/utils/digital-card-insurance';

const DEFAULT_TABLE = 'digital_business_cards';
const DEFAULT_BUCKET = 'digital-card-media';

type DigitalBusinessCardRow = {
  id: string;
  owner_id: string;
  slug: string;
  template_id: string;
  status: DigitalCardStatus;
  image_path: string | null;
  full_name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  bio: string;
  service_area: string;
  primary_action: DigitalCardPrimaryAction;
  primary_color?: string | null;
  cslb_license_number?: string | null;
  license_classification?: string | null;
  insurance_summary?: DigitalCardInsuranceSummary[] | null;
  published_at: string | null;
  updated_at: string;
};

type SaveCardOptions = {
  publish: boolean;
};

function getTableName() {
  return process.env.EXPO_PUBLIC_DIGITAL_CARD_TABLE?.trim() || DEFAULT_TABLE;
}

function getBucketName() {
  return process.env.EXPO_PUBLIC_DIGITAL_CARD_MEDIA_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function isDigitalCardBackendConfigured() {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function nowIso() {
  return new Date().toISOString();
}

function toSlugPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function createUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const resolved = char === 'x' ? value : (value & 0x3) | 0x8;
    return resolved.toString(16);
  });
}

function createSlug(draft: DigitalCardDraft) {
  const prefix = toSlugPart(draft.company) || toSlugPart(draft.fullName) || 'contractor';
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
}

function isRemoteUrl(value: string | null | undefined) {
  return /^https?:\/\//i.test(value?.trim() ?? '');
}

function inferImageContentType(uri: string) {
  const lower = uri.split('?')[0].toLowerCase();

  if (lower.endsWith('.png')) {
    return { contentType: 'image/png', extension: 'png' };
  }

  if (lower.endsWith('.webp')) {
    return { contentType: 'image/webp', extension: 'webp' };
  }

  return { contentType: 'image/jpeg', extension: 'jpg' };
}

function mapRowToCard(row: DigitalBusinessCardRow): DigitalBusinessCard {
  const supabase = getSupabaseClient();
  const imageUrl = row.image_path
    ? isRemoteUrl(row.image_path)
      ? row.image_path
      : supabase.storage.from(getBucketName()).getPublicUrl(row.image_path).data.publicUrl
    : null;

  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    templateId: 'insurepro-classic',
    status: row.status,
    imageUrl,
    fullName: row.full_name,
    title: row.title,
    company: row.company,
    phone: row.phone,
    email: row.email,
    website: row.website,
    bio: row.bio,
    serviceArea: row.service_area,
    primaryAction: row.primary_action,
    primaryColor: getDigitalCardPrimaryColor(row.primary_color),
    cslbLicenseNumber: row.cslb_license_number ?? '',
    licenseClassification: row.license_classification ?? '',
    insuranceSummary: normalizeDigitalCardInsuranceSummary(row.insurance_summary),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

async function getAuthenticatedUserId() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    throw new Error('Sign in again before publishing your digital business card.');
  }

  return data.user.id;
}

async function getCardRowForOwner(ownerId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(getTableName())
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as DigitalBusinessCardRow | null;
}

async function uploadCardImage(ownerId: string, cardId: string, draft: DigitalCardDraft) {
  const localImageUri = draft.localImageUri?.trim();

  if (!localImageUri || isRemoteUrl(localImageUri)) {
    return null;
  }

  const { contentType, extension } = inferImageContentType(localImageUri);
  const response = await fetch(localImageUri);
  const blob = await response.blob();
  const path = `${ownerId}/${cardId}/${Date.now().toString(36)}.${extension}`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(getBucketName()).upload(path, blob, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return path;
}

async function saveDigitalBusinessCard(draft: DigitalCardDraft, options: SaveCardOptions) {
  const ownerId = await getAuthenticatedUserId();
  const existing = await getCardRowForOwner(ownerId);
  const cardId = existing?.id ?? createUuid();
  const uploadedImagePath = await uploadCardImage(ownerId, cardId, draft);
  const timestamp = nowIso();
  const status: DigitalCardStatus = options.publish ? 'published' : 'draft';
  const imagePath = uploadedImagePath
    ? uploadedImagePath
    : draft.imageUrl || draft.localImageUri
      ? existing?.image_path ?? (isRemoteUrl(draft.imageUrl) ? draft.imageUrl : null)
      : null;
  const row = {
    id: cardId,
    owner_id: ownerId,
    slug: existing?.slug || draft.slug || createSlug(draft),
    template_id: 'insurepro-classic',
    status,
    image_path: imagePath,
    full_name: draft.fullName,
    title: draft.title,
    company: draft.company,
    phone: draft.phone,
    email: draft.email,
    website: draft.website,
    bio: draft.bio,
    service_area: draft.serviceArea,
    primary_action: draft.primaryAction,
    primary_color: getDigitalCardPrimaryColor(draft.primaryColor),
    cslb_license_number: draft.cslbLicenseNumber,
    license_classification: draft.licenseClassification,
    insurance_summary: normalizeDigitalCardInsuranceSummary(draft.insuranceSummary),
    published_at: status === 'published' ? existing?.published_at ?? timestamp : existing?.published_at ?? null,
    updated_at: timestamp,
  };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(getTableName())
    .upsert(row, { onConflict: 'owner_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapRowToCard(data as DigitalBusinessCardRow);
}

export async function getDigitalBusinessCard(_ownerId: string) {
  const ownerId = await getAuthenticatedUserId();
  const row = await getCardRowForOwner(ownerId);
  return row ? mapRowToCard(row) : null;
}

export async function getPublishedDigitalBusinessCardBySlug(slug: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(getTableName())
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRowToCard(data as DigitalBusinessCardRow) : null;
}

export async function publishDigitalBusinessCard(_ownerId: string, draft: DigitalCardDraft) {
  return saveDigitalBusinessCard(draft, { publish: true });
}

export async function updateDigitalBusinessCard(_ownerId: string, draft: DigitalCardDraft) {
  return saveDigitalBusinessCard(draft, { publish: true });
}
