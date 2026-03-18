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

export function getNameFromEmail(email: string | null) {
  if (!email) return 'Member';
  const token = email.split('@')[0] ?? 'Member';
  return token.charAt(0).toUpperCase() + token.slice(1);
}
