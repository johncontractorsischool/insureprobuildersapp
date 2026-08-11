import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRegisterForPushNotifications = jest.fn();
const mockSavePushDeviceToken = jest.fn();
const mockSetStringAsync = jest.fn();

jest.mock('@/services/push-notifications', () => ({
  registerForPushNotifications: () => mockRegisterForPushNotifications(),
  savePushDeviceToken: (...args: unknown[]) => mockSavePushDeviceToken(...args),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

const { PushNotificationTestCard } = require('@/components/push-notification-test-card') as typeof import('@/components/push-notification-test-card');

describe('PushNotificationTestCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetStringAsync.mockResolvedValue(undefined);
    mockSavePushDeviceToken.mockResolvedValue(undefined);
  });

  it('shows and copies a registered Expo push token', async () => {
    mockRegisterForPushNotifications.mockResolvedValue({
      status: 'registered',
      message: 'Ready. Copy this token into the Expo Push Notification Tool.',
      token: 'ExponentPushToken[test-token]',
    });

    const { findByText, getByText } = render(<PushNotificationTestCard />);

    expect(await findByText('ExponentPushToken[test-token]')).toBeTruthy();
    expect(await findByText('Saved to Supabase for this signed-in customer.')).toBeTruthy();
    expect(mockSavePushDeviceToken).toHaveBeenCalledWith('ExponentPushToken[test-token]');
    fireEvent.press(getByText('Copy Token'));

    await waitFor(() => {
      expect(mockSetStringAsync).toHaveBeenCalledWith('ExponentPushToken[test-token]');
      expect(getByText('Token Copied')).toBeTruthy();
    });
  });

  it('shows a denied-permission status without rendering a copy action', async () => {
    mockRegisterForPushNotifications.mockResolvedValue({
      status: 'permission-denied',
      message: 'Notification permission is off. Enable notifications in iPhone Settings.',
      token: null,
    });

    const { findByText, queryByText } = render(<PushNotificationTestCard />);

    expect(await findByText(/Notification permission is off/)).toBeTruthy();
    expect(queryByText('Copy Token')).toBeNull();
  });
});
