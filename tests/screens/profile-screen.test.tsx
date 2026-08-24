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
const mockDeleteCurrentSupabaseAccount = jest.fn();
const mockRefreshDigitalCard = jest.fn();
const mockRefreshDigitalCardDraftStatus = jest.fn();
const mockRegisterForPushNotifications = jest.fn();

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
jest.mock('@/services/account-deletion-api', () => ({
  deleteCurrentSupabaseAccount: (...args: unknown[]) => mockDeleteCurrentSupabaseAccount(...args),
}));
jest.mock('@/services/push-notifications', () => ({
  registerForPushNotifications: () => mockRegisterForPushNotifications(),
  savePushDeviceToken: jest.fn(() => Promise.resolve()),
}));

const ProfileScreen = require('@/app/(tabs)/profile').default;

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRegisterForPushNotifications.mockResolvedValue({
      status: 'simulator',
      message: 'Push notifications require a physical iPhone.',
      token: null,
    });
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({ accountId: 'account-1' }),
      userEmail: 'jane@example.com',
      signOut: jest.fn(),
    });
    mockCreateClientContactRequest.mockResolvedValue(undefined);
    mockDeleteCurrentSupabaseAccount.mockResolvedValue(undefined);
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

  it('hides the digital business card while the feature is disabled', () => {
    const { queryByText } = render(<ProfileScreen />);

    expect(queryByText('Digital business card')).toBeNull();
  });

  it('deletes the account after confirmation', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({ accountId: 'account-1' }),
      userEmail: 'jane@example.com',
      signOut,
    });

    const { getAllByText, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByText('Delete Account'));
    fireEvent.press(getAllByText('Delete Account')[1]);

    await waitFor(() => expect(mockDeleteCurrentSupabaseAccount).toHaveBeenCalledWith());
    fireEvent.press(getByText('OK'));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('shows an account deletion error when the request fails', async () => {
    mockDeleteCurrentSupabaseAccount.mockRejectedValue(
      new Error('Account deletion service is unavailable.')
    );

    const { findByText, getAllByText, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByText('Delete Account'));
    fireEvent.press(getAllByText('Delete Account')[1]);

    expect(await findByText('Account deletion service is unavailable.')).toBeTruthy();
  });
});
