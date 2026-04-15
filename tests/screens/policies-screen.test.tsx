import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { buildPolicy } from '@/tests/factories';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
const mockUsePolicies = jest.fn();

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
}));
jest.mock('@/context/policies-context', () => ({
  usePolicies: () => mockUsePolicies(),
}));

const PoliciesScreen = require('@/app/(tabs)/policies').default;

describe('PoliciesScreen', () => {
  it('renders grouped coverage sections and routes to the selected policy detail', () => {
    mockUsePolicies.mockReturnValue({
      policies: [buildPolicy({ id: 'policy-pending', productName: 'Workers Compensation', status: 'Pending' })],
      isLoadingPolicies: false,
      policiesError: null,
      refreshPolicies: jest.fn(),
    });

    const { getByText, getAllByText } = render(<PoliciesScreen />);

    expect(getByText('Workers Compensation')).toBeTruthy();
    expect(getAllByText('View Policy Details').length).toBeGreaterThan(0);

    fireEvent.press(getAllByText('View Policy Details')[0]);

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/policy/[id]',
      params: { id: 'policy-pending' },
    });
  });
});
