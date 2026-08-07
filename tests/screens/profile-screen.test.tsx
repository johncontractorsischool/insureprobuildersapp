import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildCustomer } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseAuth = jest.fn();
const mockCreateClientContactRequest = jest.fn();
const mockRefreshDigitalCard = jest.fn();
const mockRefreshDigitalCardDraftStatus = jest.fn();

jest.mock('expo-router', () => ({ __esModule: true, router: mockRouter }));
jest.mock('@/context/auth-context', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('@/context/digital-card-context', () => ({
  useDigitalCard: () => ({
    card: null,
    hasDraft: false,
    isLoading: false,
    isSaving: false,
    error: null,
    refresh: mockRefreshDigitalCard,
    refreshDraftStatus: mockRefreshDigitalCardDraftStatus,
    publish: jest.fn(),
    update: jest.fn(),
  }),
}));
jest.mock('@/services/contact-request-api', () => ({
  createClientContactRequest: (...args: unknown[]) => mockCreateClientContactRequest(...args),
}));

const ProfileScreen = require('@/app/(tabs)/profile').default;

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({ accountId: 'account-1' }),
      userEmail: 'jane@example.com',
      signOut: jest.fn(),
    });
    mockCreateClientContactRequest.mockResolvedValue(undefined);
  });

  it('submits profile changes as a PBIA contact request', async () => {
    const { getByDisplayValue, getByText, findByText } = render(<ProfileScreen />);

    fireEvent.press(getByText('Edit Profile'));
    fireEvent.changeText(getByDisplayValue('Jane'), 'Janet');
    fireEvent.press(getByText('Submit Update Request'));

    await waitFor(() =>
      expect(mockCreateClientContactRequest).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({
          accountId: 'account-1',
          callbackNumber: '5559990000',
          preferredContactMethod: 'EMAIL',
          description: expect.stringContaining('First Name: Jane -> Janet'),
        })
      )
    );
    expect(await findByText('Your profile update request was submitted to PBIA.')).toBeTruthy();
  });
});
