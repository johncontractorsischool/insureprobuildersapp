import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockUseAuth = jest.fn();
const mockRegisterForPushNotifications = jest.fn();
const mockSavePushDeviceToken = jest.fn();

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/push-notifications', () => ({
  registerForPushNotifications: () => mockRegisterForPushNotifications(),
  savePushDeviceToken: (...args: unknown[]) => mockSavePushDeviceToken(...args),
}));

const { PushNotificationRegistration } = require('@/components/push-notification-registration') as typeof import('@/components/push-notification-registration');

describe('PushNotificationRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoadingAuth: false,
    });
    mockSavePushDeviceToken.mockResolvedValue(undefined);
  });

  it('registers and saves the token after authentication', async () => {
    mockRegisterForPushNotifications.mockResolvedValue({
      status: 'registered',
      message: 'Ready.',
      token: 'ExponentPushToken[test-token]',
    });

    render(<PushNotificationRegistration />);

    await waitFor(() => {
      expect(mockSavePushDeviceToken).toHaveBeenCalledWith('ExponentPushToken[test-token]');
    });
  });

  it('does nothing before authentication is ready', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
    });

    render(<PushNotificationRegistration />);

    expect(mockRegisterForPushNotifications).not.toHaveBeenCalled();
    expect(mockSavePushDeviceToken).not.toHaveBeenCalled();
  });

  it('does not save when registration has no token', async () => {
    mockRegisterForPushNotifications.mockResolvedValue({
      status: 'permission-denied',
      message: 'Notifications are disabled.',
      token: null,
    });

    render(<PushNotificationRegistration />);

    await waitFor(() => {
      expect(mockRegisterForPushNotifications).toHaveBeenCalledTimes(1);
    });
    expect(mockSavePushDeviceToken).not.toHaveBeenCalled();
  });
});
