import { withApiKeyHeader } from '@/services/api-request-headers';

const DEFAULT_EMAIL_API_BASE_URL = 'http://localhost:3000';

type SmtpEmailRequest = {
  subject: string;
  html: string;
  to: string[];
  cc?: string[];
};

function getEmailApiBaseUrl() {
  return process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() || DEFAULT_EMAIL_API_BASE_URL;
}

function normalizeEmailAddress(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function normalizeRecipientList(values: string[]) {
  return values
    .map((value) => normalizeEmailAddress(value))
    .filter((value): value is string => Boolean(value));
}

export async function sendSmtpEmail(input: SmtpEmailRequest): Promise<void> {
  const to = normalizeRecipientList(input.to);
  const cc = normalizeRecipientList(input.cc ?? []);

  if (to.length === 0) {
    throw new Error('A support email recipient is required before sending this notification.');
  }

  const response = await fetch(`${getEmailApiBaseUrl()}/email/smtp/send`, {
    method: 'POST',
    headers: withApiKeyHeader({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      subject: input.subject.trim(),
      html: input.html,
      to,
      cc: cc.length > 0 ? cc : undefined,
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'The SMTP email endpoint is not available yet. Enable POST /email/smtp/send on the backend to send profile update notifications.'
      );
    }

    if (response.status >= 500) {
      throw new Error('We updated your profile, but could not send the support notification right now. Please try again shortly.');
    }

    const message = await response.text();
    const normalizedMessage = message.trim();
    if (normalizedMessage) {
      throw new Error(normalizedMessage);
    }

    throw new Error('We updated your profile, but could not send the support notification right now.');
  }
}

export type { SmtpEmailRequest };
