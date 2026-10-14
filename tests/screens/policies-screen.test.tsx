import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';

import PoliciesScreen from '@/screens/routes/tabs/policies-screen';
import { buildPolicy } from '@/tests/factories';

const mockRouter = { push: jest.fn() };
const mockUsePolicies = jest.fn();
const mockRefreshPolicies = jest.fn();
const mockOpenBrowser = jest.fn(async (..._args: unknown[]) => ({ ok: true }));
jest.mock('@/hooks/use-pbia-form-url', () => ({ usePbiaFormUrl: () => ({ buildUrl: (form: { slug: string }) => `https://example.com/forms/${form.slug}` }) }));
jest.mock('@/utils/external-actions', () => ({ openInAppBrowser: (...args: unknown[]) => mockOpenBrowser(...args) }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockRouter.push(...args) } }));
jest.mock('@/context/policies-context', () => ({ usePolicies: () => mockUsePolicies() }));

beforeEach(() => {
  mockUsePolicies.mockReturnValue({ policies: [], isLoadingPolicies: false, policiesError: null, refreshPolicies: mockRefreshPolicies });
});

it.each([false, true])('shows active policies and quote cards for missing coverage (desktop=%s)', (isDesktopLayout) => {
  mockUsePolicies.mockReturnValue({ ...mockUsePolicies(), policies: [
    buildPolicy({ id: 'wc', policyNumber: '654345', lineOfBusiness: "Workers' Compensation", premium: 100 }),
    buildPolicy({ id: 'llc', policyNumber: '24312323', lineOfBusiness: 'LLC Bond', premium: 200 }),
    buildPolicy({ id: 'pending', status: 'Pending', policyNumber: 'HIDDEN-PENDING' }),
    buildPolicy({ id: 'lapsed', status: 'Lapsed', policyNumber: 'HIDDEN-LAPSED' }),
    buildPolicy({ id: 'quote', recordType: 'QUOTE', status: 'Active', policyNumber: 'HIDDEN-QUOTE' }),
  ] });
  const view = render(<PoliciesScreen isDesktopLayout={isDesktopLayout} />);
  for (const key of ['workers-comp', 'llc-bond']) {
    const section = within(view.getByTestId(`coverage-${key}`));
    expect(section.getByText('View Policy Details')).toBeTruthy();
    expect(section.queryByText('Request a Quote')).toBeNull();
  }
  expect(within(view.getByTestId('coverage-llc-bond')).getByText('LLC Employee/Worker Bond')).toBeTruthy();
  for (const key of ['clb-bond', 'general-liability', 'commercial-auto']) {
    const section = within(view.getByTestId(`coverage-${key}`));
    expect(section.getByText('No Active Policy on File')).toBeTruthy();
    expect(section.getByText('Request a Quote')).toBeTruthy();
    expect(section.queryByText('View Policy Details')).toBeNull();
  }
  expect(view.queryAllByText(/HIDDEN/)).toHaveLength(0);
  expect(view.queryAllByText(/Pending:|Lapsed:/)).toHaveLength(0);
  expect(view.getAllByText('View Policy Details')).toHaveLength(2);
  fireEvent.press(view.getAllByText('View Policy Details')[1]);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/policy/[id]', params: { id: 'llc' } });
  fireEvent.press(view.getByText('Refresh'));
  expect(mockRefreshPolicies).toHaveBeenCalled();
  if (isDesktopLayout) {
    const summary = within(view.getByTestId('active-policy-summary'));
    expect(summary.getByText('Active policies')).toBeTruthy();
    expect(summary.getByText('$300.00')).toBeTruthy();
    expect(summary.getAllByText('2')).toHaveLength(2);
    expect(summary.getByText('3')).toBeTruthy();
    expect(view.getAllByText('Active policy on file')).toHaveLength(2);
    expect(view.getAllByText('No active policy')).toHaveLength(3);
  }
});

it('retains unfamiliar coverage and separate policies under the same heading without duplicate IDs', () => {
  const first = buildPolicy({ id: 'one', policyNumber: 'ONE', lineOfBusiness: 'Flood' });
  mockUsePolicies.mockReturnValue({ ...mockUsePolicies(), policies: [first, first, buildPolicy({ id: 'two', policyNumber: 'TWO', lineOfBusiness: 'Flood' })] });
  const view = render(<PoliciesScreen />);
  expect(view.getByText('Flood')).toBeTruthy();
  expect(view.getAllByText('View Policy Details')).toHaveLength(2);
});

it.each([false, true])('shows all five quote cards with no active policies (desktop=%s)', (isDesktopLayout) => {
  const view = render(<PoliciesScreen isDesktopLayout={isDesktopLayout} />);
  expect(view.getAllByText('No Active Policy on File')).toHaveLength(5);
  expect(view.getAllByText('Request a Quote')).toHaveLength(isDesktopLayout ? 10 : 5);
  expect(view.queryByText('View Policy Details')).toBeNull();
  fireEvent.press(view.getByText('Refresh'));
  expect(mockRefreshPolicies).toHaveBeenCalled();
});

it.each(['ios', 'web'] as const)('opens the correct quote form for every coverage on %s', async (platform) => {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  try {
    const view = render(<PoliciesScreen isDesktopLayout={platform === 'web'} />);
    for (const [key, slug] of [
      ['workers-comp', 'workers-comp'], ['llc-bond', 'bond-request'], ['clb-bond', 'bond-quote'],
      ['general-liability', 'general-liability'], ['commercial-auto', 'commercial-auto'],
    ]) {
      fireEvent.press(within(view.getByTestId(`coverage-${key}`)).getByText('Request a Quote'));
      if (platform === 'web') {
        expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/forms/[slug]', params: { slug, policyId: undefined } });
      } else {
        expect(mockOpenBrowser).toHaveBeenLastCalledWith(`https://example.com/forms/${slug}`, 'The form link is unavailable right now.');
      }
    }
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  }
});

it('preserves an error and retry instead of presenting a successful empty state', () => {
  mockUsePolicies.mockReturnValue({ ...mockUsePolicies(), policiesError: 'Service unavailable' });
  const view = render(<PoliciesScreen />);
  expect(view.getByText('Unable to load policies')).toBeTruthy();
  expect(view.queryByText('No Active Policy on File')).toBeNull();
  fireEvent.press(view.getByText('Retry'));
  expect(mockRefreshPolicies).toHaveBeenCalled();
});

it('keeps the loading state separate from an empty result', () => {
  mockUsePolicies.mockReturnValue({ ...mockUsePolicies(), isLoadingPolicies: true });
  const view = render(<PoliciesScreen />);
  expect(view.queryByText('No Active Policy on File')).toBeNull();
});
