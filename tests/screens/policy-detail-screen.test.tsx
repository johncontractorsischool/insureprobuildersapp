import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildCustomer, buildPolicy } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockUseAuth = jest.fn();
const mockUsePolicies = jest.fn();
const mockFetchPolicyCoveragesByPolicyId = jest.fn();
const mockUseIsDesktopWebLayout = jest.fn(() => false);

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/context/policies-context', () => ({
  usePolicies: () => mockUsePolicies(),
}));
jest.mock('@/services/policy-coverages-api', () => ({
  fetchPolicyCoveragesByPolicyId: (...args: unknown[]) => mockFetchPolicyCoveragesByPolicyId(...args),
}));
jest.mock('@/components/web-auth-shell', () => ({
  useIsDesktopWebLayout: () => mockUseIsDesktopWebLayout(),
}));

const PolicyDetailScreen = require('@/app/policy/[id]').default;

describe('PolicyDetailScreen', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'policy-1' });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      customer: buildCustomer({ databaseId: 'insured-db-1' }),
    });
    mockUsePolicies.mockReturnValue({
      policies: [
        buildPolicy({
          id: 'policy-1',
          productName: "Worker's Compensation",
          policyNumber: 'WC-1001',
          carrierName: 'Carrier Co',
        }),
      ],
      isLoadingPolicies: false,
      policiesError: null,
      refreshPolicies: jest.fn(),
    });
  });

  it('renders coverage details and a browse policy files action without inline documents or billing', async () => {
    mockFetchPolicyCoveragesByPolicyId.mockResolvedValue([
      {
        id: 'coverage-1',
        title: "Worker's Compensation",
        rows: [
          { label: 'Each Accident Limit', value: '$1,000,000' },
          { label: 'Policy Limit', value: '$1,000,000' },
        ],
      },
    ]);

    const { findByText, getByText, queryByText } = render(<PolicyDetailScreen />);

    await waitFor(() => expect(mockFetchPolicyCoveragesByPolicyId).toHaveBeenCalledWith('policy-1'));

    expect(await findByText('Each Accident Limit')).toBeTruthy();
    expect(getByText('Browse Policy Files')).toBeTruthy();
    expect(queryByText('101000937.URBANEDGE CONSTRUCTION INC....pdf')).toBeNull();
    expect(queryByText('Insured item / person')).toBeNull();
    expect(queryByText('Billing Summary')).toBeNull();
    expect(queryByText('Outstanding Balance')).toBeNull();
    expect(queryByText('Invoices')).toBeNull();

    fireEvent.press(getByText('Browse Policy Files'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/policy-files',
      params: {
        insuredId: 'insured-db-1',
        policyId: 'policy-1',
        policyNumber: 'WC-1001',
      },
    });
  });
});
