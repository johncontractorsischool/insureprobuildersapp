import { PolicyFileEntry, PolicyFileOrFolder, PolicyFilesListResponse } from '@/types/policy-file';

const DEFAULT_POLICY_FILES_API_BASE_URL = 'http://localhost:3000';

function getPolicyFilesApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_POLICY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL?.trim() ||
    DEFAULT_POLICY_FILES_API_BASE_URL
  );
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function toObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeFileOrFolder(value: unknown): PolicyFileOrFolder {
  const normalized = normalizeText(value)?.toLowerCase();
  if (normalized === 'folder') return 'Folder';
  return 'File';
}

function mapPolicyFileEntry(value: unknown): PolicyFileEntry | null {
  const payload = toObject(value);
  if (!payload) return null;

  const databaseId = normalizeText(payload.databaseId);
  if (!databaseId) return null;

  return {
    databaseId,
    insuredId: normalizeText(payload.insuredId),
    policyId: normalizeText(payload.policyId),
    policyNumber: normalizeText(payload.policyNumber),
    name: normalizeText(payload.name) ?? 'Untitled',
    type: normalizeNumber(payload.type),
    createDate: normalizeText(payload.createDate),
    changeDate: normalizeText(payload.changeDate),
    creatorName: normalizeText(payload.creatorName),
    fileOrFolder: normalizeFileOrFolder(payload.fileOrFolder),
    fileUrl: normalizeText(payload.fileUrl),
    downloadUrl: normalizeText(payload.downloadUrl),
    url: normalizeText(payload.url),
  };
}

function extractFileEntries(value: unknown): PolicyFileEntry[] | null {
  if (Array.isArray(value)) {
    return value
      .map((entry) => mapPolicyFileEntry(entry))
      .filter((entry): entry is PolicyFileEntry => Boolean(entry));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return extractFileEntries(parsed);
    } catch {
      return null;
    }
  }

  const payload = toObject(value);
  if (!payload) return null;

  const nestedCandidates = [
    payload.data,
    payload.items,
    payload.files,
    payload.results,
    payload.rows,
    payload.list,
  ];

  for (const candidate of nestedCandidates) {
    const resolved = extractFileEntries(candidate);
    if (resolved) return resolved;
  }

  const singleEntry = mapPolicyFileEntry(payload);
  if (singleEntry) return [singleEntry];

  return null;
}

function mapPolicyFilesPayload(payload: unknown): PolicyFilesListResponse {
  const parsed = toObject(payload);
  if (!parsed) {
    throw new Error('Unexpected policy files response format.');
  }

  const status = typeof parsed.status === 'number' ? parsed.status : -1;
  const message = normalizeText(parsed.message) ?? normalizeText(parsed.Message);
  const data = extractFileEntries(parsed.data);
  if (!data) {
    throw new Error('Unexpected policy files data format.');
  }

  return {
    status,
    message,
    data,
  };
}

async function requestPolicyFiles(path: string): Promise<PolicyFilesListResponse> {
  const url = `${getPolicyFilesApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Policy files lookup failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  const parsed = mapPolicyFilesPayload(payload);

  if (parsed.status !== 1) {
    throw new Error(parsed.message ?? 'Policy files lookup failed.');
  }

  return parsed;
}

export async function fetchPolicyFilesListByInsuredId(insuredId: string): Promise<PolicyFilesListResponse> {
  const trimmedInsuredId = insuredId.trim();
  if (!trimmedInsuredId) {
    throw new Error('Missing insured id for policy files lookup.');
  }

  return requestPolicyFiles(`/getPolicyFilesListByInsuredId?insuredId=${encodeURIComponent(trimmedInsuredId)}`);
}

type PolicyFilesFolderParams = {
  insuredId: string;
  policyId: string;
  folderId: string;
};

export async function fetchPolicyFilesList(params: PolicyFilesFolderParams): Promise<PolicyFilesListResponse> {
  const insuredId = params.insuredId.trim();
  const policyId = params.policyId.trim();
  const folderId = params.folderId.trim();

  if (!insuredId || !policyId || !folderId) {
    throw new Error('Missing insured id, policy id, or folder id for policy files lookup.');
  }

  return requestPolicyFiles(
    `/getPolicyFilesList?insuredId=${encodeURIComponent(insuredId)}&policyId=${encodeURIComponent(policyId)}&folderId=${encodeURIComponent(folderId)}`
  );
}
