import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import PolicyFilesScreen from '@/app/policy-files';
import { PbiaApiError } from '@/services/pbia-client';
import { buildCustomer, buildPolicyFileEntry } from '@/tests/factories';
import type { PolicyFileEntry, PolicyFilesListResponse } from '@/types/policy-file';

const mockParams = jest.fn();
const mockAuth = jest.fn();
const mockList = jest.fn();
const mockAccountList = jest.fn();
const mockViewUrl = jest.fn();
const mockBrowserOpen = jest.fn();
const mockBrowserClose = jest.fn();
jest.mock('@/utils/document-browser', () => ({
  prepareDocumentBrowser: () => ({ open: mockBrowserOpen, close: mockBrowserClose }),
}));
const mockFocusCallbacks = new Set<() => (() => void) | void>();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
  useFocusEffect: (callback: () => (() => void) | void) => {
    require('react').useEffect(() => {
      mockFocusCallbacks.add(callback);
      const cleanup = callback();
      return () => {
        mockFocusCallbacks.delete(callback);
        cleanup?.();
      };
    }, [callback]);
  },
}));
jest.mock('@/context/auth-context', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/services/policy-files-api', () => ({
  fetchClientPolicyDocuments: (...args: unknown[]) => mockList(...args),
  fetchClientDocuments: (...args: unknown[]) => mockAccountList(...args),
  fetchClientDocumentViewUrl: (...args: unknown[]) => mockViewUrl(...args),
}));
jest.mock('@/components/document-content', () => ({
  DocumentContent: ({ url, onError }: { url: string; onError: () => void }) => {
    const React = require('react');
    const { View, Text, Pressable } = require('react-native');
    return React.createElement(
      View,
      { testID: 'embedded-document' },
      React.createElement(Text, null, url),
      React.createElement(
        Pressable,
        { onPress: onError },
        React.createElement(Text, null, 'Simulate preview error')
      )
    );
  },
}));

function page(
  data: PolicyFileEntry[],
  overrides: Partial<PolicyFilesListResponse> = {}
): PolicyFilesListResponse {
  return {
    data,
    page: 1,
    pageSize: 50,
    total: data.length,
    totalPages: 1,
    partial: false,
    totalScope: 'ALL_SOURCES',
    sources: { pbia: 'AVAILABLE', momentum: 'AVAILABLE' },
    ...overrides,
  };
}
const file = (key = 'pbia:one', name = 'saved.pdf') =>
  buildPolicyFileEntry({
    documentKey: key,
    source: 'PBIA',
    openStatus: 'AVAILABLE',
    name,
  });

beforeEach(() => {
  mockList.mockReset();
  mockAccountList.mockReset();
  mockViewUrl.mockReset();
  mockBrowserOpen.mockReset().mockResolvedValue(undefined);
  mockBrowserClose.mockReset();
  mockAuth.mockReturnValue({
    userEmail: 'jane@example.com',
    customer: buildCustomer({ accountId: 'account-1' }),
  });
  mockParams.mockReturnValue({
    accountId: 'account-1',
    policyId: 'policy-1',
    policyNumber: 'GL-1001',
  });
});

it('loads one page, keeps same-name uploads and deduplicates load-more results by source key', async () => {
  mockList
    .mockResolvedValueOnce(page([file(), file('pbia:two')], { total: 3, totalPages: 2 }))
    .mockResolvedValueOnce(
      page([file('pbia:two'), file('momentum:one', 'history.pdf')], {
        page: 2,
        total: 3,
        totalPages: 2,
      })
    );
  const view = render(<PolicyFilesScreen />);
  await waitFor(() => expect(view.getAllByText('saved.pdf')).toHaveLength(2));
  expect(mockList).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText('Load more'));
  await view.findByText('history.pdf');
  expect(view.getAllByText('saved.pdf')).toHaveLength(2);
  expect(mockList).toHaveBeenLastCalledWith(
    'jane@example.com',
    expect.objectContaining({ page: 2, policyId: 'policy-1' })
  );
  expect(view.queryByText('Load more')).toBeNull();
});

it('keeps PBIA uploads visible during a historical-source outage', async () => {
  mockList.mockResolvedValue(
    page([file()], {
      partial: true,
      totalScope: 'AVAILABLE_SOURCES',
      sources: { pbia: 'AVAILABLE', momentum: 'UNAVAILABLE' },
    })
  );
  const view = render(<PolicyFilesScreen />);
  await view.findByText('saved.pdf');
  expect(view.getByText(/Historical files are temporarily unavailable/)).toBeTruthy();
});

it('does not describe partial empty results as no documents', async () => {
  mockList.mockResolvedValue(
    page([], {
      partial: true,
      totalScope: 'AVAILABLE_SOURCES',
      sources: { pbia: 'AVAILABLE', momentum: 'UNAVAILABLE' },
    })
  );
  const view = render(<PolicyFilesScreen />);
  await view.findByText(/Historical files are temporarily unavailable/);
  expect(view.queryByText('No documents available')).toBeNull();
});

it('shows a successful empty state separately from loading and failed requests', async () => {
  let resolve!: (value: PolicyFilesListResponse) => void;
  mockList.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  const view = render(<PolicyFilesScreen />);
  expect(view.getByText('Loading policy files')).toBeTruthy();
  expect(view.queryByText('No documents available')).toBeNull();
  await act(async () => resolve(page([])));
  expect(view.getByText('No documents available')).toBeTruthy();
  mockList.mockRejectedValueOnce(new Error('Service unavailable'));
  fireEvent.press(view.getByText('Refresh'));
  await view.findByText('Unable to load policy files');
  expect(view.queryByText('No documents available')).toBeNull();
});

it('loads folders only on tap and refreshes root on return without duplicate rows', async () => {
  const folder = buildPolicyFileEntry({
    documentKey: 'momentum:folder',
    databaseId: 'folder',
    fileOrFolder: 'Folder',
    name: 'History',
    source: 'MOMENTUM',
    openStatus: 'UNAVAILABLE',
  });
  mockList
    .mockResolvedValueOnce(page([folder, file()]))
    .mockResolvedValueOnce(page([file(), file()]))
    .mockResolvedValueOnce(page([folder, file()]));
  const view = render(<PolicyFilesScreen />);
  await view.findByText('History');
  expect(mockList).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText('History'));
  await waitFor(() =>
    expect(mockList).toHaveBeenLastCalledWith(
      'jane@example.com',
      expect.objectContaining({ folderId: 'folder', page: 1 })
    )
  );
  await view.findByText('saved.pdf');
  expect(view.getAllByText('saved.pdf')).toHaveLength(1);
  fireEvent.press(view.getByText('Back to documents'));
  await view.findByText('History');
  expect(view.getAllByText('saved.pdf')).toHaveLength(1);
});

it('refreshes on focus and replaces the previous list', async () => {
  mockList
    .mockResolvedValueOnce(page([file()]))
    .mockResolvedValueOnce(page([file('pbia:new', 'new.pdf')]));
  const view = render(<PolicyFilesScreen />);
  await view.findByText('saved.pdf');
  act(() => {
    mockFocusCallbacks.forEach((focus) => focus());
  });
  await view.findByText('new.pdf');
  expect(view.queryByText('saved.pdf')).toBeNull();
});

it('ignores old account responses and does not reopen a stale route account', async () => {
  let resolve!: (value: PolicyFilesListResponse) => void;
  mockList.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  const view = render(<PolicyFilesScreen />);
  mockAuth.mockReturnValue({
    userEmail: 'other@example.com',
    customer: buildCustomer({ accountId: 'account-2' }),
  });
  view.rerender(<PolicyFilesScreen />);
  await act(async () => resolve(page([file()])));
  expect(view.queryByText('saved.pdf')).toBeNull();
  expect(mockList).toHaveBeenCalledTimes(1);
});

it('opens with a fresh link on every retry and never uses old row URLs', async () => {
  mockList.mockResolvedValue(page([file()]));
  mockViewUrl
    .mockResolvedValueOnce({ url: 'https://example.com/first', expiresInSeconds: 300 })
    .mockResolvedValueOnce({ url: 'https://example.com/fresh', expiresInSeconds: 300 });
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('saved.pdf'));
  await view.findByText('https://example.com/first');
  fireEvent.press(view.getByText('Simulate preview error'));
  await view.findByText('Unable to display this document. Retry to request a fresh link.');
  fireEvent.press(view.getByRole('button', { name: 'Retry preview' }));
  await view.findByText('https://example.com/fresh');
  expect(mockViewUrl).toHaveBeenCalledTimes(2);
  expect(mockViewUrl).toHaveBeenLastCalledWith('jane@example.com', {
    accountId: 'account-1',
    policyId: 'policy-1',
    documentKey: 'pbia:one',
  });
});

it('labels replica-only files truthfully and never calls the opening endpoint', async () => {
  mockList.mockResolvedValue(
    page([
      buildPolicyFileEntry({
        documentKey: 'momentum:one',
        source: 'MOMENTUM',
        openStatus: 'UNAVAILABLE',
        name: 'historical.pdf',
      }),
    ])
  );
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('historical.pdf'));
  expect(view.getByText('Opening unavailable')).toBeTruthy();
  expect(mockViewUrl).not.toHaveBeenCalled();
});

it.each([401, 403, 404])(
  'clears cached files on opening denial %s without account fallback',
  async (status) => {
    mockList.mockResolvedValue(page([file()]));
    mockViewUrl.mockRejectedValue(new PbiaApiError(status, 'Not found'));
    const view = render(<PolicyFilesScreen />);
    fireEvent.press(await view.findByText('saved.pdf'));
    await view.findByText('Unable to load policy files');
    expect(view.queryByText('saved.pdf')).toBeNull();
    expect(mockAccountList).not.toHaveBeenCalled();
    expect(view.queryByTestId('embedded-document')).toBeNull();
  }
);

it('discards opening responses after the selected policy changes', async () => {
  let resolve!: (value: { url: string; expiresInSeconds: number }) => void;
  mockList.mockResolvedValueOnce(page([file()])).mockResolvedValueOnce(page([]));
  mockViewUrl.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('saved.pdf'));
  mockParams.mockReturnValue({ accountId: 'account-1', policyId: 'policy-2' });
  view.rerender(<PolicyFilesScreen />);
  await act(async () => resolve({ url: 'https://example.com/old', expiresInSeconds: 300 }));
  expect(view.queryByTestId('embedded-document')).toBeNull();
});

it('keeps loaded rows after a failed next page and retries only that page', async () => {
  mockList
    .mockResolvedValueOnce(page([file()], { total: 2, totalPages: 2 }))
    .mockRejectedValueOnce(new Error('Temporary outage'))
    .mockResolvedValueOnce(
      page([file('pbia:two', 'second.pdf')], { page: 2, total: 2, totalPages: 2 })
    );
  const view = render(<PolicyFilesScreen />);
  await view.findByText('saved.pdf');
  fireEvent.press(view.getByText('Load more'));
  await view.findByText('Temporary outage');
  expect(view.getByText('saved.pdf')).toBeTruthy();
  fireEvent.press(view.getByText('Retry load more'));
  await view.findByText('second.pdf');
  expect(mockList.mock.calls.map((call) => call[1].page)).toEqual([1, 2, 2]);
});

it('clears cached files when refresh reports revoked policy access', async () => {
  mockList
    .mockResolvedValueOnce(page([file()]))
    .mockRejectedValueOnce(new PbiaApiError(404, 'Not found'));
  const view = render(<PolicyFilesScreen />);
  await view.findByText('saved.pdf');
  fireEvent.press(view.getByText('Refresh'));
  await view.findByText('Unable to load policy files');
  expect(view.queryByText('saved.pdf')).toBeNull();
  expect(mockAccountList).not.toHaveBeenCalled();
});

it('does not append shifted pages when source availability changes', async () => {
  mockList.mockResolvedValueOnce(page([file()], { total: 2, totalPages: 2 })).mockResolvedValueOnce(
    page([file('pbia:other', 'shifted.pdf')], {
      page: 2,
      partial: true,
      totalScope: 'AVAILABLE_SOURCES',
      sources: { pbia: 'AVAILABLE', momentum: 'UNAVAILABLE' },
    })
  );
  const view = render(<PolicyFilesScreen />);
  await view.findByText('saved.pdf');
  fireEvent.press(view.getByText('Load more'));
  await view.findByText('Document availability changed. Refresh to reload the list.');
  expect(view.queryByText('shifted.pdf')).toBeNull();
  expect(view.queryByText('Load more')).toBeNull();
});

it('ignores a late policy listing after navigating to another policy', async () => {
  let resolve!: (value: PolicyFilesListResponse) => void;
  mockList
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    )
    .mockResolvedValueOnce(
      page([
        buildPolicyFileEntry({
          documentKey: 'pbia:current',
          policyId: 'policy-2',
          policyNumber: null,
          name: 'current.pdf',
        }),
      ])
    );
  const view = render(<PolicyFilesScreen />);
  mockParams.mockReturnValue({ accountId: 'account-1', policyId: 'policy-2' });
  view.rerender(<PolicyFilesScreen />);
  await view.findByText('current.pdf');
  await act(async () => resolve(page([file()])));
  expect(view.queryByText('saved.pdf')).toBeNull();
  expect(view.getByText('current.pdf')).toBeTruthy();
});

it('shows the document inside My Account and closes back to the list', async () => {
  mockList.mockResolvedValue(page([file()]));
  mockViewUrl.mockResolvedValue({ url: 'https://example.com/private.pdf', expiresInSeconds: 300 });
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('saved.pdf'));
  await view.findByText('https://example.com/private.pdf');
  expect(view.getByTestId('embedded-document')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Close document' }));
  expect(view.queryByTestId('embedded-document')).toBeNull();
  expect(view.getByText('saved.pdf')).toBeTruthy();
});

it('does not reopen the viewer when a link arrives after closing', async () => {
  let resolve!: (value: { url: string; expiresInSeconds: number }) => void;
  mockList.mockResolvedValue(page([file()]));
  mockViewUrl.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('saved.pdf'));
  fireEvent.press(view.getByRole('button', { name: 'Close document' }));
  await act(async () => resolve({ url: 'https://example.com/old', expiresInSeconds: 300 }));
  expect(view.queryByTestId('embedded-document')).toBeNull();
});

it('opens externally with a fresh authorized link while keeping the embedded preview', async () => {
  mockList.mockResolvedValue(page([file()]));
  mockViewUrl
    .mockResolvedValueOnce({ url: 'https://example.com/preview', expiresInSeconds: 300 })
    .mockResolvedValueOnce({ url: 'https://example.com/external', expiresInSeconds: 300 });
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('saved.pdf'));
  await view.findByText('https://example.com/preview');
  fireEvent.press(view.getByRole('button', { name: 'Open in browser' }));
  await waitFor(() => expect(mockBrowserOpen).toHaveBeenCalledWith('https://example.com/external'));
  expect(mockViewUrl).toHaveBeenCalledTimes(2);
  expect(view.getByTestId('embedded-document')).toBeTruthy();
});

it('closes a pending external tab and ignores its link after closing the viewer', async () => {
  let resolve!: (value: { url: string; expiresInSeconds: number }) => void;
  mockList.mockResolvedValue(page([file()]));
  mockViewUrl
    .mockResolvedValueOnce({ url: 'https://example.com/preview', expiresInSeconds: 300 })
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('saved.pdf'));
  await view.findByText('https://example.com/preview');
  fireEvent.press(view.getByRole('button', { name: 'Open in browser' }));
  fireEvent.press(view.getByRole('button', { name: 'Open in browser' }));
  expect(mockViewUrl).toHaveBeenCalledTimes(2);
  fireEvent.press(view.getByRole('button', { name: 'Close document' }));
  expect(mockBrowserClose).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ url: 'https://example.com/late', expiresInSeconds: 300 }));
  expect(mockBrowserOpen).not.toHaveBeenCalled();
});

it.each([401, 403, 404])(
  'clears the preview and closes the external tab after denial %s',
  async (status) => {
    mockList.mockResolvedValue(page([file()]));
    mockViewUrl
      .mockResolvedValueOnce({ url: 'https://example.com/preview', expiresInSeconds: 300 })
      .mockRejectedValueOnce(new PbiaApiError(status, 'Not found'));
    const view = render(<PolicyFilesScreen />);
    fireEvent.press(await view.findByText('saved.pdf'));
    await view.findByText('https://example.com/preview');
    fireEvent.press(view.getByRole('button', { name: 'Open in browser' }));
    await view.findByText('Unable to load policy files');
    expect(mockBrowserClose).toHaveBeenCalled();
    expect(mockBrowserOpen).not.toHaveBeenCalled();
    expect(view.queryByTestId('embedded-document')).toBeNull();
  }
);

it('allows external opening when the embedded preview fails', async () => {
  mockList.mockResolvedValue(page([file()]));
  mockViewUrl.mockResolvedValue({ url: 'https://example.com/document', expiresInSeconds: 300 });
  mockBrowserOpen.mockRejectedValueOnce(new Error('Browser unavailable'));
  const view = render(<PolicyFilesScreen />);
  fireEvent.press(await view.findByText('saved.pdf'));
  await view.findByText('https://example.com/document');
  fireEvent.press(view.getByText('Simulate preview error'));
  fireEvent.press(view.getByRole('button', { name: 'Open in browser' }));
  await view.findByText('Unable to open the document in your browser. Please try again.');
  expect(mockBrowserClose).toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Open in browser' }));
  await waitFor(() => expect(mockBrowserOpen).toHaveBeenCalledTimes(2));
  expect(mockViewUrl).toHaveBeenCalledTimes(3);
});
