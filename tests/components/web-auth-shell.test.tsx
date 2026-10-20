import React, { useEffect, useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { WebAuthShell } from '@/components/web-auth-shell';

jest.mock('expo-router', () => ({ usePathname: () => '/policy-files' }));
jest.mock('@/context/auth-context', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/brand-mark', () => ({ BrandMark: () => null }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

it('preserves an open document when resizing across the desktop breakpoint in both directions', () => {
  const mounted = jest.fn();
  const unmounted = jest.fn();
  function DocumentScreen() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return (
      <Pressable onPress={() => setOpen(true)}>
        <Text>{open ? 'Document is open' : 'Open document'}</Text>
      </Pressable>
    );
  }
  const dimensions = jest.mocked(useWindowDimensions);
  dimensions.mockReturnValue({ width: 1200, height: 800, scale: 1, fontScale: 1 });
  const screen = () => (
    <WebAuthShell>
      <DocumentScreen />
    </WebAuthShell>
  );
  const view = render(screen());
  fireEvent.press(view.getByText('Open document'));
  expect(view.getByText('Document is open')).toBeTruthy();
  expect(view.getByText('Dashboard')).toBeTruthy();

  dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
  view.rerender(screen());
  expect(view.getByText('Document is open')).toBeTruthy();
  expect(view.queryByText('Dashboard')).toBeNull();

  dimensions.mockReturnValue({ width: 1200, height: 800, scale: 1, fontScale: 1 });
  view.rerender(screen());
  expect(view.getByText('Document is open')).toBeTruthy();
  expect(view.getByText('Dashboard')).toBeTruthy();
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
});
