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
