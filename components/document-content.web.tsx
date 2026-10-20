import type { DocumentContentProps } from '@/utils/document-preview';

export function DocumentContent({ url, kind, title, onError }: DocumentContentProps) {
  if (kind === 'image') {
    return (
      <img
        src={url}
        alt={title}
        referrerPolicy="no-referrer"
        onError={onError}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    );
  }
  // Browsers render the signed PDF directly; no third-party viewer receives the private URL.
  return (
    <iframe
      src={url}
      title={title}
      referrerPolicy="no-referrer"
      onError={onError}
      style={{ width: '100%', height: '100%', border: 0 }}
    />
  );
}
