export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatIsoDateTime(value: string | null | undefined) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function trimContactValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function formatEmailAddress(email: string | null | undefined) {
  return trimContactValue(email).toLowerCase();
}

export function formatPhoneNumber(value: string | null | undefined) {
  const trimmed = trimContactValue(value);

  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
}

export function getNameFromEmail(email: string | null) {
  if (!email) return 'Member';
  const token = email.split('@')[0] ?? 'Member';
  return token.charAt(0).toUpperCase() + token.slice(1);
}

type CustomerNameSource = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function getNameFromCustomer(customer: CustomerNameSource | null, fallbackEmail: string | null) {
  const fullName = customer?.fullName?.trim();
  if (fullName) return fullName;

  const first = customer?.firstName?.trim();
  const last = customer?.lastName?.trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;

  return getNameFromEmail(fallbackEmail);
}
