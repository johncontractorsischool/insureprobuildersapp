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
  it('filters policies by status and routes to the selected policy detail', () => {
    mockUsePolicies.mockReturnValue({
      policies: [
        buildPolicy({ id: 'policy-active', productName: 'General Liability', status: 'Active' }),
        buildPolicy({ id: 'policy-pending', productName: 'Workers Compensation', status: 'Pending' }),
      ],
      isLoadingPolicies: false,
      policiesError: null,
      refreshPolicies: jest.fn(),
    });

    const { getByText, getAllByText, queryByText } = render(<PoliciesScreen />);

    expect(getByText('General Liability')).toBeTruthy();
    expect(getByText('Workers Compensation')).toBeTruthy();

    fireEvent.press(getAllByText('Pending')[0]);
    expect(queryByText('General Liability')).toBeNull();
    expect(getByText('Workers Compensation')).toBeTruthy();

    fireEvent.press(getByText('Workers Compensation'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/policy/[id]',
      params: { id: 'policy-pending' },
    });
  });
});
