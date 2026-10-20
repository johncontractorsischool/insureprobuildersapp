import { PolicyFileEntry } from '@/types/policy-file';

export function hasVisiblePolicyDocumentName(name: string | null | undefined) {
  return Boolean(name?.trim());
}

export function matchesSelectedPolicyFile(
  entry: PolicyFileEntry,
  selectedPolicyId: string,
  selectedPolicyNumber: string
) {
  const entryPolicyId = entry.policyId?.trim() || '';
  const entryPolicyNumber = entry.policyNumber?.trim() || '';

  if (selectedPolicyId && entryPolicyId && !sameExternalId(entryPolicyId, selectedPolicyId)) {
    return false;
  }

  if (selectedPolicyNumber && entryPolicyNumber && entryPolicyNumber !== selectedPolicyNumber) {
    return false;
  }

  return true;
}

export function sortPolicyFilesNewestFirst(entries: PolicyFileEntry[]) {
  return [...entries].sort((left, right) => {
    const leftDate = left.changeDate ?? left.createDate ?? '';
    const rightDate = right.changeDate ?? right.createDate ?? '';
    return rightDate.localeCompare(leftDate);
  });
}

// Only UUIDs are case-insensitive. Opaque identifiers retain their exact identity.
export function sameExternalId(left: string, right: string) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid.test(left) && uuid.test(right)
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

export function mergePolicyFiles(existing: PolicyFileEntry[], incoming: PolicyFileEntry[]) {
  const rows = new Map(existing.map((entry) => [entry.documentKey, entry]));
  for (const entry of incoming) rows.set(entry.documentKey, entry);
  return [...rows.values()];
}
