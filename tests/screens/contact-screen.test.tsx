import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildCustomer } from '@/tests/factories';

const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockUseAuth = jest.fn();
const mockCreateClientContactRequest = jest.fn();

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
jest.mock('@/services/contact-request-api', () => ({
  createClientContactRequest: (...args: unknown[]) => mockCreateClientContactRequest(...args),
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
        accountId: 'account-1',
        insuredId: 'LIC-123456',
      }),
      userEmail: 'jane@example.com',
    });
    mockCreateClientContactRequest.mockResolvedValue(undefined);
  });

  it('submits a support request through PBIA', async () => {
    mockUseLocalSearchParams.mockReturnValue({ topic: 'support' });

    const { getByLabelText, getByText, findByText, queryByText } = render(<ContactScreen />);

    expect(queryByText('Account Details')).toBeNull();

    fireEvent.changeText(getByLabelText('Message'), 'I need help with my policy.');
    fireEvent.press(getByText('Send Support Request'));

    await waitFor(() =>
      expect(mockCreateClientContactRequest).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({
          accountId: 'account-1',
          callbackNumber: '5559990000',
          preferredContactMethod: 'EMAIL',
          description: expect.stringContaining('I need help with my policy.'),
        })
      )
    );
    expect(await findByText('Your support request has been sent.')).toBeTruthy();
  });

  it('submits feedback through PBIA', async () => {
    mockUseLocalSearchParams.mockReturnValue({ topic: 'feedback' });

    const { getByLabelText, getByText, findByText } = render(<ContactScreen />);

    fireEvent.changeText(getByLabelText('Message'), 'The app is easy to use.');
    fireEvent.press(getByText('Send Feedback'));

    await waitFor(() =>
      expect(mockCreateClientContactRequest).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({
          description: expect.stringContaining('The app is easy to use.'),
        })
      )
    );
    expect(await findByText('Your feedback has been sent.')).toBeTruthy();
  });
});
