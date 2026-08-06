import { buildClientQuery, pbiaRequest } from '@/services/pbia-client';
import type { PolicyFileEntry, PolicyFilesListResponse } from '@/types/policy-file';

type ClientDocumentRecord = {
  id: string;
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
};

type ClientDocumentQuery = {
  accountId: string;
  policyId?: string;
  folderId?: string;
};

function isClientDocument(value: unknown): value is ClientDocumentRecord {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<ClientDocumentRecord>;
  return (
    typeof document.id === 'string' &&
    typeof document.name === 'string' &&
    typeof document.isFolder === 'boolean'
  );
}

function mapDocument(document: ClientDocumentRecord, accountId: string): PolicyFileEntry {
  return {
    databaseId: document.id,
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
  const payload = await loadPage(1);

  if (!payload || !Array.isArray(payload.data) || !payload.data.every(isClientDocument)) {
    throw new Error('Unexpected PBIA documents response format.');
  }

  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, payload.totalPages - 1) }, (_, index) => loadPage(index + 2))
  );
  const documents = [payload, ...remainingPages].flatMap((page) => page.data);
  if (!documents.every(isClientDocument)) {
    throw new Error('Unexpected PBIA documents response format.');
  }

  return {
    status: 1,
    message: null,
    data: documents.map((document) => mapDocument(document, accountId)),
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
    { accountId: query.accountId, folderId: query.folderId }
  );
}
