import {
  fetchPolicyFilesList,
  fetchPolicyFilesListByInsuredId,
} from '@/services/policy-files-api';

describe('policy-files api', () => {
  it('parses nested stringified file data returned by the root lookup', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        message: 'ok',
        data: JSON.stringify([
          {
            databaseId: 'file-1',
            insuredId: 'insured-db-1',
            policyId: 'policy-1',
            policyNumber: 'GL-1001',
            name: 'Folder A',
            fileOrFolder: 'Folder',
            createDate: '2026-02-01T00:00:00.000Z',
          },
        ]),
      }),
    }) as unknown as typeof fetch;

    const response = await fetchPolicyFilesListByInsuredId('insured-db-1');

    expect(response.status).toBe(1);
    expect(response.data).toEqual([
      expect.objectContaining({
        databaseId: 'file-1',
        fileOrFolder: 'Folder',
        name: 'Folder A',
      }),
    ]);
  });

  it('loads nested folder items with all required identifiers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        data: [
          {
            databaseId: 'file-2',
            insuredId: 'insured-db-1',
            policyId: 'policy-1',
            policyNumber: 'GL-1001',
            name: 'Declarations',
            fileOrFolder: 'File',
          },
        ],
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await fetchPolicyFilesList({
      insuredId: 'insured-db-1',
      policyId: 'policy-1',
      folderId: 'folder-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/getPolicyFilesList?insuredId=insured-db-1&policyId=policy-1&folderId=folder-1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(response.data[0].name).toBe('Declarations');
  });

  it('rejects folder requests that are missing required ids', async () => {
    await expect(
      fetchPolicyFilesList({
        insuredId: '',
        policyId: 'policy-1',
        folderId: 'folder-1',
      })
    ).rejects.toThrow('Missing insured id, policy id, or folder id for policy files lookup.');
  });
});
