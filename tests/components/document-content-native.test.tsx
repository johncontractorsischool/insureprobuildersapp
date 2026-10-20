import React from 'react';
import { render } from '@testing-library/react-native';
import { DocumentContent } from '@/components/document-content';

let mockEnvironment = 'standalone';
const mockImage = jest.fn();
const mockNative = jest.fn();
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get executionEnvironment() {
      return mockEnvironment;
    },
  },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('expo-image', () => ({
  Image: (props: unknown) => {
    mockImage(props);
    return null;
  },
}));
jest.mock('@/components/native-document-content', () => ({
  NativeDocumentContent: (props: unknown) => {
    mockNative(props);
    return require('react').createElement(require('react-native').Text, null, 'Native PDF preview');
  },
}));

it('keeps Expo Go usable without loading unsupported PDF native modules', () => {
  mockEnvironment = 'storeClient';
  const view = render(
    <DocumentContent
      url="https://storage.example/file"
      kind="pdf"
      title="Policy.pdf"
      onError={() => undefined}
    />
  );
  expect(view.getByText(/not available in Expo Go/)).toBeTruthy();
  expect(mockNative).not.toHaveBeenCalled();
});

it('renders images inside the app without a persistent image cache', () => {
  mockEnvironment = 'storeClient';
  render(
    <DocumentContent
      url="https://storage.example/image"
      kind="image"
      title="Policy photo"
      onError={() => undefined}
    />
  );
  expect(mockImage).toHaveBeenCalledWith(
    expect.objectContaining({
      source: { uri: 'https://storage.example/image' },
      cachePolicy: 'none',
      accessibilityLabel: 'Policy photo',
    })
  );
});

it('loads the native PDF component in an installed app build', async () => {
  mockEnvironment = 'standalone';
  const view = render(
    <DocumentContent
      url="https://storage.example/file"
      kind="pdf"
      title="Policy.pdf"
      onError={() => undefined}
    />
  );
  await view.findByText('Native PDF preview');
  expect(mockNative).toHaveBeenCalledWith(
    expect.objectContaining({ url: 'https://storage.example/file' })
  );
});
