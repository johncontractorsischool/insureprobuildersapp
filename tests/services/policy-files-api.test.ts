import { fetchClientDocuments, fetchClientPolicyDocuments } from '@/services/policy-files-api';

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
