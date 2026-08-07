import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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
const mockOpenInAppBrowser = jest.fn(() => Promise.resolve({ ok: true }));

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
