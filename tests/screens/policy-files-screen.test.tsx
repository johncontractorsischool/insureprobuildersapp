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
const mockFetchPolicyFilesListByInsuredId = jest.fn();
const mockFetchPolicyFilesList = jest.fn();
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
  fetchPolicyFilesListByInsuredId: (...args: unknown[]) => mockFetchPolicyFilesListByInsuredId(...args),
  fetchPolicyFilesList: (...args: unknown[]) => mockFetchPolicyFilesList(...args),
}));
jest.mock('@/utils/external-actions', () => ({
  openInAppBrowser: (...args: unknown[]) => mockOpenInAppBrowser(...args),
}));

describe('PolicyFilesScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({ databaseId: 'insured-db-1' }),
    });
    mockUseLocalSearchParams.mockReturnValue({
      insuredId: 'insured-db-1',
      policyId: 'policy-1',
      policyNumber: 'GL-1001',
    });
  });

  it('loads the root level, opens folders, and opens file links', async () => {
    mockFetchPolicyFilesListByInsuredId.mockResolvedValue({
      status: 1,
      message: null,
      data: [
        buildPolicyFileEntry({
          databaseId: 'folder-1',
          fileOrFolder: 'Folder',
          name: 'Policies',
        }),
      ],
    });
    mockFetchPolicyFilesList.mockResolvedValue({
      status: 1,
      message: null,
      data: [
        buildPolicyFileEntry({
          databaseId: 'file-2',
          fileOrFolder: 'File',
          name: 'Declarations',
        }),
      ],
    });

    const { getByText, findByText } = render(<PolicyFilesScreen />);

    expect(await findByText('Policies')).toBeTruthy();

    fireEvent.press(getByText('Policies'));

    await waitFor(() =>
      expect(mockFetchPolicyFilesList).toHaveBeenCalledWith({
        insuredId: 'insured-db-1',
        policyId: 'policy-1',
        folderId: 'folder-1',
      })
    );

    expect(await findByText('Declarations')).toBeTruthy();

    fireEvent.press(getByText('Declarations'));

    await waitFor(() =>
      expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
        'https://example.com/file.pdf',
        'File link is not available.'
      )
    );
  });
});
