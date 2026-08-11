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

  if (selectedPolicyId && entryPolicyId && entryPolicyId !== selectedPolicyId) {
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
