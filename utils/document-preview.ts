export type DocumentKind = 'pdf' | 'image';
export type DocumentContentProps = {
  url: string;
  kind: DocumentKind;
  title: string;
  onError: () => void;
};

export function documentKind(file: {
  mimeType?: string | null;
  name: string;
}): DocumentKind | null {
  const mime = file.mimeType?.split(';')[0].trim().toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png' || mime === 'image/jpeg') return 'image';
  if (mime && mime !== 'application/octet-stream') return null;
  if (/\.pdf$/i.test(file.name)) return 'pdf';
  if (/\.(png|jpe?g)$/i.test(file.name)) return 'image';
  return null;
}
