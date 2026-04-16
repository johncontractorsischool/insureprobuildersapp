import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildCustomer } from '@/tests/factories';

const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockUseAuth = jest.fn();
const mockSendSmtpEmail = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/services/smtp-email-api', () => ({
  sendSmtpEmail: (...args: unknown[]) => mockSendSmtpEmail(...args),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => ({
    actions: {
      supportEmail: 'support@insureprobuilders.com',
    },
  }),
}));

const ContactScreen = require('@/app/contact').default;

describe('ContactScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseAuth.mockReturnValue({
      customer: buildCustomer({
        commercialName: 'Builder Co',
        email: 'jane@example.com',
        phone: '5551112222',
        databaseId: 'insured-db-1',
        insuredId: 'LIC-123456',
      }),
      userEmail: 'jane@example.com',
    });
    mockSendSmtpEmail.mockResolvedValue(undefined);
  });

  it('sends a support email with the support subject', async () => {
    mockUseLocalSearchParams.mockReturnValue({ topic: 'support' });

    const { getByLabelText, getByText, findByText, queryByText } = render(<ContactScreen />);

    expect(queryByText('Account Details')).toBeNull();

    fireEvent.changeText(getByLabelText('Message'), 'I need help with my policy.');
    fireEvent.press(getByText('Send Support Request'));

    await waitFor(() =>
      expect(mockSendSmtpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Contact Us - Need Support',
          to: ['support@insureprobuilders.com'],
        })
      )
    );

    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('I need help with my policy.');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('Builder Co');
    expect(await findByText('Your support request has been sent.')).toBeTruthy();
  });

  it('sends a feedback email with the feedback subject', async () => {
    mockUseLocalSearchParams.mockReturnValue({ topic: 'feedback' });

    const { getByLabelText, getByText, findByText } = render(<ContactScreen />);

    fireEvent.changeText(getByLabelText('Message'), 'The app is easy to use.');
    fireEvent.press(getByText('Send Feedback'));

    await waitFor(() =>
      expect(mockSendSmtpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Contact Us - Feedback',
          to: ['support@insureprobuilders.com'],
        })
      )
    );

    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('The app is easy to use.');
    expect(await findByText('Your feedback has been sent.')).toBeTruthy();
  });
});
