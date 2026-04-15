import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildCustomer, buildCustomerLookupRecord } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseAuth = jest.fn();
const mockFetchCustomersByEmail = jest.fn();
const mockUpdateInsuredProfile = jest.fn();
const mockPersistCustomersForEmail = jest.fn();
const mockToCustomerProfile = jest.fn();
const mockSendSmtpEmail = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/services/customer-api', () => ({
  fetchCustomersByEmail: (...args: unknown[]) => mockFetchCustomersByEmail(...args),
  updateInsuredProfile: (...args: unknown[]) => mockUpdateInsuredProfile(...args),
}));
jest.mock('@/services/auth-flow', () => ({
  persistCustomersForEmail: (...args: unknown[]) => mockPersistCustomersForEmail(...args),
  toCustomerProfile: (...args: unknown[]) => mockToCustomerProfile(...args),
}));
jest.mock('@/services/portal-config', () => ({
  getPortalConfig: () => ({
    actions: {
      supportEmail: 'support@insureprobuilders.com',
    },
  }),
}));
jest.mock('@/services/smtp-email-api', () => ({
  sendSmtpEmail: (...args: unknown[]) => mockSendSmtpEmail(...args),
}));

const ProfileScreen = require('@/app/(tabs)/profile').default;

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSendSmtpEmail.mockResolvedValue(undefined);
    mockToCustomerProfile.mockImplementation((record) =>
      buildCustomer({
        databaseId: record.databaseId,
        commercialName: record.commercialName,
        firstName: record.firstName,
        lastName: record.lastName,
        fullName: [record.firstName, record.lastName].filter(Boolean).join(' '),
        type: record.type,
        email: record.eMail,
        phone: record.phone,
        cellPhone: record.cellPhone,
        customerId: record.customerId,
        insuredId: record.insuredId,
        active: record.active,
      })
    );
    mockUseAuth.mockReturnValue({
      customer: buildCustomer(),
      userEmail: 'jane@example.com',
      setCustomer: jest.fn(),
      signOut: jest.fn(),
    });
  });

  it('updates the profile through NowCerts and refreshes the full user from the lookup api', async () => {
    const setCustomer = jest.fn();
    const refreshedRecord = buildCustomerLookupRecord({
      firstName: 'Janet',
      eMail: 'janet@example.com',
      phone: '5552223333',
    });

    mockUseAuth.mockReturnValue({
      customer: buildCustomer(),
      userEmail: 'jane@example.com',
      setCustomer,
      signOut: jest.fn(),
    });
    mockUpdateInsuredProfile.mockResolvedValue(undefined);
    mockFetchCustomersByEmail.mockResolvedValue([refreshedRecord]);
    mockPersistCustomersForEmail.mockResolvedValue(undefined);

    const { getByDisplayValue, getByText, findByText } = render(<ProfileScreen />);

    fireEvent.press(getByText('Edit Profile'));
    fireEvent.changeText(getByDisplayValue('Jane'), 'Janet');
    fireEvent.changeText(getByDisplayValue('jane@example.com'), 'janet@example.com');
    fireEvent.changeText(getByDisplayValue('5551112222'), '5552223333');
    fireEvent.press(getByText('Save Profile'));

    await waitFor(() =>
      expect(mockUpdateInsuredProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'insured-db-1',
          type: 1,
          firstName: 'Janet',
          lastName: 'Builder',
          email: 'janet@example.com',
          phone: '5552223333',
          cellPhone: '5559990000',
        })
      )
    );

    expect(mockFetchCustomersByEmail).toHaveBeenCalledWith('janet@example.com');
    expect(mockPersistCustomersForEmail).toHaveBeenCalledWith('jane@example.com', [refreshedRecord]);
    expect(mockSendSmtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Profile Update Notification',
        to: ['support@insureprobuilders.com'],
        html: expect.stringContaining('First Name'),
      })
    );
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('First Name');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('Jane');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('Janet');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('Email Address');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('jane@example.com');
    expect(mockSendSmtpEmail.mock.calls[0][0].html).toContain('janet@example.com');
    expect(setCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Janet',
        email: 'janet@example.com',
        phone: '5552223333',
      })
    );
    expect(await findByText('Profile updated successfully.')).toBeTruthy();
  });
});
