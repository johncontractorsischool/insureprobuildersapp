import { Platform } from 'react-native';

import type { DigitalBusinessCard, DigitalCardDraft, DigitalCardPrimaryAction } from '@/types/digital-card';
import { buildEmailLink, buildPhoneLink } from '@/utils/external-actions';

const LOCAL_CARD_ORIGIN = 'https://cards.insureprobuilders.local';

export function getDigitalCardBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_DIGITAL_CARD_BASE_URL?.trim();
  return configured || LOCAL_CARD_ORIGIN;
}

export function isDigitalCardPublishingConfigured() {
  const configured = process.env.EXPO_PUBLIC_DIGITAL_CARD_BASE_URL?.trim();
  if (!configured) return false;

  try {
    const url = new URL(configured);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildDigitalCardPublicUrl(slug: string) {
  const base = getDigitalCardBaseUrl().replace(/\/+$/, '');
  return `${base}/card/${encodeURIComponent(slug)}`;
}

export function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'https:') return '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function buildDigitalCardPrimaryActionUrl(
  card: Pick<DigitalBusinessCard | DigitalCardDraft, 'primaryAction' | 'phone' | 'email'>,
  publicUrl: string
) {
  const action: DigitalCardPrimaryAction = card.primaryAction;

  if (action === 'call') {
    return buildPhoneLink(card.phone);
  }

  if (action === 'email') {
    return buildEmailLink(card.email, {
      subject: 'Question about your services',
      body: `I found your Insure Probuilders card: ${publicUrl}`,
    });
  }

  const encodedSource = encodeURIComponent(publicUrl);
  return `https://www.insureprobuilders.com/request-a-quote?source=digital-card&card=${encodedSource}`;
}

export function getPrimaryActionLabel(action: DigitalCardPrimaryAction) {
  if (action === 'call') return 'Call Now';
  if (action === 'email') return 'Send an Email';
  return 'Request an Estimate';
}

function escapeVCardValue(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .trim();
}

export function buildDigitalCardVCard(card: DigitalBusinessCard, publicUrl: string) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardValue(card.fullName)}`,
    card.company ? `ORG:${escapeVCardValue(card.company)}` : null,
    card.title ? `TITLE:${escapeVCardValue(card.title)}` : null,
    card.phone ? `TEL;TYPE=WORK,VOICE:${escapeVCardValue(card.phone)}` : null,
    card.email ? `EMAIL;TYPE=WORK:${escapeVCardValue(card.email)}` : null,
    card.website ? `URL:${escapeVCardValue(card.website)}` : null,
    `URL:${escapeVCardValue(publicUrl)}`,
    card.serviceArea || card.bio
      ? `NOTE:${escapeVCardValue([card.serviceArea, card.bio].filter(Boolean).join('\n'))}`
      : null,
    'END:VCARD',
  ].filter((line): line is string => Boolean(line));

  return `${lines.join('\n')}\n`;
}

export function downloadDigitalCardVCard(card: DigitalBusinessCard, publicUrl: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }

  const blob = new Blob([buildDigitalCardVCard(card, publicUrl)], { type: 'text/vcard;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const filename = `${card.slug || 'digital-card'}.vcf`;
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
  return true;
}
