import { buildClientQuery, pbiaRequest } from '@/services/pbia-client';
import type { PolicyFileEntry, PolicyFilesListResponse } from '@/types/policy-file';

type ClientDocumentRecord = {
  id: string;
  documentKey?: string;
  source?: 'PBIA' | 'MOMENTUM';
  openStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  name: string;
  mimeType: string | null;
  size: number | null;
  description: string | null;
  createdAt: string | null;
  policyId: string | null;
  parentId: string | null;
  isFolder: boolean;
};

type ClientDocumentList = {
  data: ClientDocumentRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  partial?: boolean;
  totalScope?: PolicyFilesListResponse['totalScope'];
  sources?: PolicyFilesListResponse['sources'];
};

type ClientDocumentQuery = {
  accountId: string;
  policyId?: string;
  folderId?: string;
  page?: number;
};

function isClientDocument(value: unknown): value is ClientDocumentRecord {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<ClientDocumentRecord>;
  return (
    typeof document.id === 'string' &&
    typeof document.name === 'string' &&
    typeof document.isFolder === 'boolean' &&
    (document.documentKey === undefined ||
      (typeof document.documentKey === 'string' && Boolean(document.documentKey))) &&
    (document.source === undefined ||
      document.source === 'PBIA' ||
      document.source === 'MOMENTUM') &&
    (document.openStatus === undefined ||
      document.openStatus === 'AVAILABLE' ||
      document.openStatus === 'UNAVAILABLE')
  );
}

function mapDocument(document: ClientDocumentRecord, accountId: string): PolicyFileEntry {
  return {
    databaseId: document.id,
    // Legacy replica responses remain listable, but never advertise opening support.
    documentKey: document.documentKey ?? `momentum:${document.id}`,
    source: document.source ?? 'MOMENTUM',
    openStatus:
      document.source === 'PBIA' && document.documentKey && document.openStatus === 'AVAILABLE'
        ? 'AVAILABLE'
        : 'UNAVAILABLE',
    insuredId: accountId,
    policyId: document.policyId,
    policyNumber: null,
    name: document.name,
    type: null,
    createDate: document.createdAt,
    changeDate: null,
    creatorName: null,
    fileOrFolder: document.isFolder ? 'Folder' : 'File',
    fileUrl: null,
    downloadUrl: null,
    url: null,
    mimeType: document.mimeType,
    size: document.size,
    description: document.description,
    parentId: document.parentId,
  };
}

async function requestDocuments(
  clientEmail: string,
  path: string,
  query: ClientDocumentQuery
): Promise<PolicyFilesListResponse> {
  const accountId = query.accountId.trim();
  if (!accountId) throw new Error('Missing PBIA account id for document lookup.');

  const loadPage = (page: number) =>
    pbiaRequest<ClientDocumentList>(
      `${path}${buildClientQuery({
        accountId,
        policyId: query.policyId?.trim(),
        folderId: query.folderId?.trim(),
        page,
        pageSize: 50,
      })}`,
      { method: 'GET', clientEmail },
      'Unable to load documents from PBIA.'
    );
  const requestedPage = query.page ?? 1;
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1)
    throw new Error('Invalid document page.');
  const payload = await loadPage(requestedPage);

  if (!payload || !Array.isArray(payload.data) || !payload.data.every(isClientDocument)) {
    throw new Error('Unexpected PBIA documents response format.');
  }

  if (
    payload.page !== requestedPage ||
    !Number.isSafeInteger(payload.totalPages) ||
    payload.totalPages < 0 ||
    !Number.isSafeInteger(payload.total) ||
    payload.total < 0 ||
    !Number.isSafeInteger(payload.pageSize) ||
    payload.pageSize < 1 ||
    payload.pageSize > 50
  ) {
    throw new Error('Unexpected PBIA document pagination.');
  }
  const partial = payload.partial === true;
  if (
    payload.partial !== undefined &&
    (typeof payload.partial !== 'boolean' ||
      payload.sources?.pbia !== 'AVAILABLE' ||
      payload.sources.momentum !== (partial ? 'UNAVAILABLE' : 'AVAILABLE') ||
      payload.totalScope !== (partial ? 'AVAILABLE_SOURCES' : 'ALL_SOURCES'))
  )
    throw new Error('Unexpected PBIA document availability.');

  return {
    data: payload.data.map((document) => mapDocument(document, accountId)),
    page: payload.page,
    pageSize: payload.pageSize,
    total: payload.total,
    totalPages: payload.totalPages,
    partial,
    totalScope: partial ? 'AVAILABLE_SOURCES' : 'ALL_SOURCES',
    sources: { pbia: 'AVAILABLE', momentum: partial ? 'UNAVAILABLE' : 'AVAILABLE' },
  };
}

export function fetchClientDocuments(clientEmail: string, query: ClientDocumentQuery) {
  return requestDocuments(clientEmail, '/client/documents', query);
}

export function fetchClientPolicyDocuments(
  clientEmail: string,
  query: ClientDocumentQuery & { policyId: string }
) {
  const policyId = query.policyId.trim();
  if (!policyId) throw new Error('Missing PBIA policy id for document lookup.');
  return requestDocuments(
    clientEmail,
    `/client/policies/${encodeURIComponent(policyId)}/documents`,
    { accountId: query.accountId, folderId: query.folderId, page: query.page }
  );
}

export async function fetchClientDocumentViewUrl(
  clientEmail: string,
  input: { documentKey: string; accountId: string; policyId?: string }
): Promise<{ url: string; expiresInSeconds: number }> {
  const payload = await pbiaRequest<{ url: string; expiresInSeconds: number }>(
    `/client/documents/${encodeURIComponent(input.documentKey)}/view-url${buildClientQuery({
      accountId: input.accountId,
      policyId: input.policyId,
    })}`,
    { method: 'GET', clientEmail, cache: 'no-store' },
    'Unable to open this document.'
  );
  try {
    const url = new URL(payload.url);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !Number.isFinite(payload.expiresInSeconds) ||
      payload.expiresInSeconds <= 0
    )
      throw new Error();
  } catch {
    throw new Error('The document link is unavailable. Please try again.');
  }
  return payload;
}
