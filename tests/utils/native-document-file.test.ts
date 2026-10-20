import { downloadDocumentPreview } from '@/utils/native-document-file';
const mockConfig = jest.fn();
const mockFetch = jest.fn();
const mockUnlink = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('expo-crypto', () => ({ randomUUID: () => 'random-document-id' }));
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: (...args: unknown[]) => mockConfig(...args),
    fs: {
      dirs: { CacheDir: '/private-cache' },
      unlink: (...args: unknown[]) => mockUnlink(...args),
    },
  },
}));

function task() {
  let resolve!: (result: { info: () => { status: number } }) => void;
  const promise = new Promise<{ info: () => { status: number } }>((done) => {
    resolve = done;
  });
  const cancel = jest.fn(() => undefined);
  mockFetch.mockReturnValue(Object.assign(promise, { cancel }));
  return { resolve: (status: number) => resolve({ info: () => ({ status }) }), cancel };
}
beforeEach(() => {
  mockConfig.mockReturnValue({ fetch: mockFetch });
});

it('downloads privately with certificate checks and removes the file on close', async () => {
  const transfer = task();
  const download = downloadDocumentPreview('https://storage.example/private.pdf?signature=value');
  expect(mockConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      trusty: false,
      timeout: 30000,
      path: '/private-cache/document-preview-random-document-id.pdf',
    })
  );
  expect(mockFetch).toHaveBeenCalledWith(
    'GET',
    'https://storage.example/private.pdf?signature=value'
  );
  transfer.resolve(200);
  await expect(download.ready).resolves.toBe(
    'file:///private-cache/document-preview-random-document-id.pdf'
  );
  download.dispose();
  expect(mockUnlink).toHaveBeenCalledWith('/private-cache/document-preview-random-document-id.pdf');
});

it('cancels a pending download and removes any bytes that arrive late', async () => {
  const transfer = task();
  const download = downloadDocumentPreview('https://storage.example/file');
  download.dispose();
  expect(transfer.cancel).toHaveBeenCalled();
  transfer.resolve(200);
  await expect(download.ready).resolves.toBeNull();
  expect(mockUnlink).toHaveBeenCalledTimes(2);
});

it('does not hand an expired/denied download to the renderer or expose its URL in errors', async () => {
  const transfer = task();
  const download = downloadDocumentPreview('https://storage.example/file?signature=secret');
  transfer.resolve(403);
  await expect(download.ready).rejects.toThrow('Document download failed.');
  expect(mockUnlink).toHaveBeenCalled();
});
