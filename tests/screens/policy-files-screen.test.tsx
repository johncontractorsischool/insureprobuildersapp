import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { FlatList } from 'react-native';
import PolicyFilesScreen from '@/app/policy-files';
import { buildCustomer, buildPolicyFileEntry } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockUseAuth = jest.fn();
const mockFetchClientPolicyDocuments = jest.fn();
const mockFetchClientDocuments = jest.fn();
const mockOpenInAppBrowser = jest.fn((..._args: unknown[]) => Promise.resolve({ ok: true }));

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/services/policy-files-api', () => ({
  fetchClientPolicyDocuments: (...args: unknown[]) => mockFetchClientPolicyDocuments(...args),
  fetchClientDocuments: (...args: unknown[]) => mockFetchClientDocuments(...args),
}));
jest.mock('@/utils/external-actions', () => ({
  openInAppBrowser: (...args: unknown[]) => mockOpenInAppBrowser(...args),
}));

describe('PolicyFilesScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      userEmail: 'jane@example.com',
      customer: buildCustomer({ accountId: 'account-1' }),
    });
    mockUseLocalSearchParams.mockReturnValue({
      accountId: 'account-1',
      policyId: 'policy-1',
      policyNumber: 'GL-1001',
    });
  });

  it('shows unavailable for a hidden policy without falling back to account documents', async () => {
    const { PbiaApiError } = require('@/services/pbia-client');
    mockFetchClientPolicyDocuments.mockRejectedValueOnce(new PbiaApiError(404, 'Policy not found'));
    const view = render(<PolicyFilesScreen />);
    await view.findByText('Unable to load policy files');
    expect(mockFetchClientDocuments).not.toHaveBeenCalled();
    expect(mockOpenInAppBrowser).not.toHaveBeenCalled();
  });

  it('clears previously visible documents when refresh reports a hidden policy', async () => {
    const { PbiaApiError } = require('@/services/pbia-client');
    mockFetchClientPolicyDocuments.mockResolvedValueOnce({ data: [buildPolicyFileEntry({ name: 'Declarations.pdf' })] })
      .mockRejectedValueOnce(new PbiaApiError(404, 'Policy not found'));
    const view = render(<PolicyFilesScreen />);
    await view.findByText('Declarations.pdf');
    await act(async () => view.UNSAFE_getByType(FlatList).props.onRefresh());
    await view.findByText('Unable to load policy files');
    expect(view.queryByText('Declarations.pdf')).toBeNull();
    expect(mockFetchClientDocuments).not.toHaveBeenCalled();
  });

  it('does not restore files after their route has changed', async () => {
    let resolve!: (value: { data: ReturnType<typeof buildPolicyFileEntry>[] }) => void;
    mockFetchClientPolicyDocuments.mockReturnValueOnce(new Promise((done) => { resolve = done; }))
      .mockResolvedValueOnce({ data: [buildPolicyFileEntry({ policyId: 'policy-2', name: 'Current-policy.pdf' })] });
    const view = render(<PolicyFilesScreen />);
    mockUseLocalSearchParams.mockReturnValue({ accountId: 'account-1', policyId: 'policy-2' });
    view.rerender(<PolicyFilesScreen />);
    await view.findByText('Current-policy.pdf');
    await act(async () => resolve({ data: [buildPolicyFileEntry({ name: 'Old-policy.pdf' })] }));
    expect(view.queryByText('Old-policy.pdf')).toBeNull();
    expect(view.getByText('Current-policy.pdf')).toBeTruthy();
  });

  it('loads policy files, resolves folders in the background, and only shows visible files', async () => {
    mockFetchClientPolicyDocuments
      .mockResolvedValueOnce({
        status: 1,
        message: null,
        data: [
          buildPolicyFileEntry({
            databaseId: 'folder-1',
            insuredId: null,
            policyId: null,
            fileOrFolder: 'Folder',
            name: 'Policies',
          }),
          buildPolicyFileEntry({
            databaseId: 'file-hidden',
            insuredId: null,
            policyId: null,
            fileOrFolder: 'File',
            name: 'Declarations.pdf',
          }),
        ],
      })
      .mockResolvedValueOnce({
        status: 1,
        message: null,
        data: [
          buildPolicyFileEntry({
            databaseId: 'file-2',
            insuredId: null,
            policyId: null,
            fileOrFolder: 'File',
            name: '101000937.URBANEDGE CONSTRUCTION INC....pdf',
          }),
        ],
      });

    const { getByText, findByText, queryByText } = render(<PolicyFilesScreen />);

    await waitFor(() =>
      expect(mockFetchClientPolicyDocuments).toHaveBeenNthCalledWith(1, 'jane@example.com', {
        accountId: 'account-1',
        policyId: 'policy-1',
      })
    );
    await waitFor(() =>
      expect(mockFetchClientPolicyDocuments).toHaveBeenNthCalledWith(2, 'jane@example.com', {
        accountId: 'account-1',
        policyId: 'policy-1',
        folderId: 'folder-1',
      })
    );

    expect(await findByText('101000937.URBANEDGE CONSTRUCTION INC....pdf')).toBeTruthy();
    expect(queryByText('Policies')).toBeNull();
    expect(queryByText('Declarations.pdf')).toBeTruthy();

    fireEvent.press(getByText('101000937.URBANEDGE CONSTRUCTION INC....pdf'));

    await waitFor(() =>
      expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
        'https://example.com/file.pdf',
        'File link is not available.'
      )
    );
  });
});
