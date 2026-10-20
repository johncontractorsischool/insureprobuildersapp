import { fetchClientDocuments, fetchClientPolicyDocuments } from '@/services/policy-files-api';

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: 'supabase-token',
            user: { email: 'jane@example.com' },
          },
        },
        error: null,
      }),
    },
  }),
}));

describe('PBIA documents api', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://localhost:3000';
  });

  const response = {
    ok: true,
    json: async () => ({
      data: [
        {
          id: 'doc-1',
          name: 'Declarations.pdf',
          mimeType: 'application/pdf',
          size: 100,
          description: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          policyId: 'policy-1',
          parentId: null,
          isFolder: false,
        },
      ],
      page: 1,
      pageSize: 50,
      total: 1,
      totalPages: 1,
    }),
  };

  it('loads account documents', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchClientDocuments('jane@example.com', { accountId: 'account-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/documents?accountId=account-1&page=1&pageSize=50',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.data[0]).toEqual(
      expect.objectContaining({ databaseId: 'doc-1', fileOrFolder: 'File' })
    );
  });

  it('loads policy folder documents', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchClientPolicyDocuments('jane@example.com', {
      accountId: 'account-1',
      policyId: 'policy-1',
      folderId: 'folder-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/policies/policy-1/documents?accountId=account-1&folderId=folder-1&page=1&pageSize=50',
      expect.objectContaining({ method: 'GET' })
    );
  });
});

it('loads only the requested page and preserves combined identity and partial availability', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        {
          id: 'same-id',
          documentKey: 'pbia:same-id',
          source: 'PBIA',
          openStatus: 'AVAILABLE',
          name: 'saved.pdf',
          policyId: 'external-policy',
          isFolder: false,
          createdAt: null,
        },
      ],
      page: 2,
      pageSize: 50,
      total: 125,
      totalPages: 3,
      partial: true,
      totalScope: 'AVAILABLE_SOURCES',
      sources: { pbia: 'AVAILABLE', momentum: 'UNAVAILABLE' },
    }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  const result = await fetchClientPolicyDocuments('jane@example.com', {
    accountId: 'account-1',
    policyId: 'policy-1',
    page: 2,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain('page=2&pageSize=50');
  expect(result).toMatchObject({
    page: 2,
    totalPages: 3,
    partial: true,
    totalScope: 'AVAILABLE_SOURCES',
  });
  expect(result.data[0]).toMatchObject({
    documentKey: 'pbia:same-id',
    source: 'PBIA',
    openStatus: 'AVAILABLE',
    policyId: 'external-policy',
  });
});

it('requests fresh encoded customer view URLs with bearer auth and no cache', async () => {
  const { fetchClientDocumentViewUrl } = require('@/services/policy-files-api');
  const fetchMock = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        url: 'https://storage.example/signed?token=one',
        expiresInSeconds: 300,
      }),
    });
  global.fetch = fetchMock as unknown as typeof fetch;
  await fetchClientDocumentViewUrl('jane@example.com', {
    documentKey: 'pbia:doc/one',
    accountId: 'account-1',
    policyId: 'policy-1',
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'http://localhost:3000/client/documents/pbia%3Adoc%2Fone/view-url?accountId=account-1&policyId=policy-1',
    expect.objectContaining({
      cache: 'no-store',
      headers: expect.objectContaining({ Authorization: 'Bearer supabase-token' }),
    })
  );
});

it('rejects unsafe opening URLs', async () => {
  const { fetchClientDocumentViewUrl } = require('@/services/policy-files-api');
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'javascript:alert(1)', expiresInSeconds: 300 }),
    });
  await expect(
    fetchClientDocumentViewUrl('jane@example.com', {
      documentKey: 'pbia:one',
      accountId: 'account-1',
      policyId: 'policy-1',
    })
  ).rejects.toThrow();
});
