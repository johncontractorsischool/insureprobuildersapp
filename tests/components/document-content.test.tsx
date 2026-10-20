import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { NativeDocumentContent } from '@/components/native-document-content';
import { documentKind } from '@/utils/document-preview';

const mockDownload = jest.fn();
const mockDispose = jest.fn();
const mockPdf = jest.fn();
jest.mock('@/utils/native-document-file', () => ({
  downloadDocumentPreview: (...args: unknown[]) => mockDownload(...args),
}));
jest.mock('react-native-pdf', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockPdf(props);
    return null;
  },
}));

it('renders a private local PDF with zoom and certificate validation and cleans up on exit', async () => {
  mockDownload.mockReturnValue({
    ready: Promise.resolve('file:///private-cache/test.pdf'),
    dispose: mockDispose,
  });
  const error = jest.fn();
  const view = render(
    <NativeDocumentContent
      url="https://storage.example/signed"
      kind="pdf"
      title="Policy.pdf"
      onError={error}
    />
  );
  await waitFor(() => expect(mockPdf).toHaveBeenCalled());
  const props = mockPdf.mock.lastCall?.[0];
  expect(props).toMatchObject({
    source: { uri: 'file:///private-cache/test.pdf', cache: false },
    trustAllCerts: false,
    enableDoubleTapZoom: true,
  });
  act(() => props.onPageChanged(2, 5));
  expect(view.getByText('Page 2 of 5')).toBeTruthy();
  act(() => props.onError(new Error('provider error with sensitive details')));
  expect(error).toHaveBeenCalledWith();
  view.unmount();
  expect(mockDispose).toHaveBeenCalled();
});

it.each([
  ['application/pdf', 'file.bin', 'pdf'],
  ['image/png', 'file.bin', 'image'],
  ['image/jpeg', 'file.bin', 'image'],
  [null, 'Policy.PDF', 'pdf'],
  [null, 'Photo.JPG', 'image'],
  ['text/html', 'Policy.pdf', null],
])('chooses a supported preview for %s / %s', (mimeType, name, expected) => {
  expect(documentKind({ mimeType, name: name! })).toBe(expected);
});
