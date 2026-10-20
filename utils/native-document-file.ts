import BlobUtil from 'react-native-blob-util';
import { randomUUID } from 'expo-crypto';

/** Download to a private temporary file; closing cancels the transfer and removes its bytes. */
export function downloadDocumentPreview(url: string) {
  const path = `${BlobUtil.fs.dirs.CacheDir}/document-preview-${randomUUID()}.pdf`;
  let disposed = false;
  const remove = () => BlobUtil.fs.unlink(path).catch(() => undefined);
  const task = BlobUtil.config({ path, trusty: false, timeout: 30000, overwrite: true }).fetch(
    'GET',
    url
  );
  const ready = (async () => {
    try {
      const response = await task;
      if (disposed) return null;
      if (response.info().status < 200 || response.info().status >= 300) {
        await remove();
        throw new Error('Document download failed.');
      }
      return `file://${path}`;
    } catch {
      await remove();
      if (!disposed) throw new Error('Document download failed.');
      return null;
    } finally {
      if (disposed) await remove();
    }
  })();
  return {
    ready,
    dispose: () => {
      disposed = true;
      // Blob-util's runtime cancel returns void, despite its Promise return type.
      try {
        task.cancel();
      } catch {
        /* A completed transfer may already be released. */
      }
      void remove();
    },
  };
}
