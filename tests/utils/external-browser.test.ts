import { openBrowserAsync } from 'expo-web-browser';
import { Platform } from 'react-native';

import { openExternalBrowser } from '@/utils/external-browser';

const destination = 'https://carrier.example/Finance?Quote=AbC%2F123&token=x%2By#agreement';
const originalOS = Platform.OS;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

it.each(['ios', 'android'])('opens the exact destination with the native browser on %s', async (os) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  await openExternalBrowser(destination);
  expect(openBrowserAsync).toHaveBeenCalledWith(destination, { presentationStyle: 'AUTOMATIC' });
});

it('opens synchronously on web, severs opener access and preserves the signed destination', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  const meta = { name: '', content: '' };
  const tab = {
    opener: {} as object | null,
    document: { createElement: jest.fn(() => meta), head: { appendChild: jest.fn() } },
    location: { replace: jest.fn() }, close: jest.fn(),
  };
  const open = jest.fn(() => tab);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { open } });
  const result = openExternalBrowser(destination);
  expect(open).toHaveBeenCalledWith('about:blank', '_blank');
  expect(tab.opener).toBeNull();
  expect(meta).toEqual({ name: 'referrer', content: 'no-referrer' });
  expect(tab.location.replace).toHaveBeenCalledWith(destination);
  await result;
  expect(openBrowserAsync).not.toHaveBeenCalled();
});

it('reports a blocked web popup without calling the native opener', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { open: jest.fn(() => null) } });
  await expect(openExternalBrowser(destination)).rejects.toThrow('could not open a new tab');
  expect(openBrowserAsync).not.toHaveBeenCalled();
});

it('rejects unsafe navigation before calling an opener', async () => {
  await expect(openExternalBrowser('javascript:alert(1)')).rejects.toThrow('unavailable');
  expect(openBrowserAsync).not.toHaveBeenCalled();
});
