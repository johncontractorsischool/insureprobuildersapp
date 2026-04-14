import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

type OpenExternalResult = {
  ok: boolean;
  message?: string;
};

type EmailLinkOptions = {
  subject?: string | null;
  body?: string | null;
  cc?: string | null;
  bcc?: string | null;
};

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().replace(/[^\d+]/g, '');
  return normalized ? normalized : null;
}

export function buildPhoneLink(phone: string | null | undefined) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `tel:${normalized}`;
}

export function buildSmsLink(phone: string | null | undefined) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `sms:${normalized}`;
}

export function buildEmailLink(
  email: string | null | undefined,
  options: EmailLinkOptions = {}
) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  const params = new URLSearchParams();

  if (options.subject?.trim()) {
    params.set('subject', options.subject.trim());
  }

  if (options.body?.trim()) {
    params.set('body', options.body.trim());
  }

  if (options.cc?.trim()) {
    params.set('cc', options.cc.trim());
  }

  if (options.bcc?.trim()) {
    params.set('bcc', options.bcc.trim());
  }

  const query = params.toString();
  return query ? `mailto:${normalized}?${query}` : `mailto:${normalized}`;
}

export async function openExternalLink(
  target: string | null | undefined,
  unavailableMessage = 'This action is not configured yet.'
): Promise<OpenExternalResult> {
  if (!target) {
    return {
      ok: false,
      message: unavailableMessage,
    };
  }

  const shouldOpenDirectly =
    target.startsWith('tel:') || target.startsWith('sms:') || target.startsWith('mailto:');

  try {
    if (shouldOpenDirectly) {
      await Linking.openURL(target);
      return { ok: true };
    }

    const canOpen = await Linking.canOpenURL(target);
    if (!canOpen) {
      return {
        ok: false,
        message: 'This link cannot be opened on this device.',
      };
    }

    await Linking.openURL(target);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'Unable to open this link right now. Please try again later.',
    };
  }
}

export async function openInAppBrowser(
  target: string | null | undefined,
  unavailableMessage = 'This action is not configured yet.'
): Promise<OpenExternalResult> {
  if (!target) {
    return {
      ok: false,
      message: unavailableMessage,
    };
  }

  const isHttpTarget = /^https?:\/\//i.test(target);
  if (!isHttpTarget) {
    return openExternalLink(target, unavailableMessage);
  }

  try {
    await WebBrowser.openBrowserAsync(target);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'Unable to open this link right now. Please try again later.',
    };
  }
}
