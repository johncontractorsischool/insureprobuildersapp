import { Linking, Platform } from 'react-native';
import { prepareDocumentBrowser } from '@/utils/document-browser';

const originalOS = Platform.OS;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const destination = 'https://files.example/document?token=a%2Fb&sig=X%2BY';

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

function webTab() {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  const meta = { name: '', content: '' };
  const tab = {
    opener: {} as object | null,
    closed: false,
    document: { createElement: jest.fn(() => meta), head: { appendChild: jest.fn() } },
    location: { replace: jest.fn() },
    close: jest.fn(),
  };
  const open = jest.fn(() => tab);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { open } });
  return { tab, meta, open };
}

it('reserves a tab synchronously, isolates its opener and navigates to the exact signed URL', async () => {
  const { tab, meta, open } = webTab();
  const browser = prepareDocumentBrowser();
  expect(open).toHaveBeenCalledWith('about:blank', '_blank');
  expect(tab.opener).toBeNull();
  expect(meta).toEqual({ name: 'referrer', content: 'no-referrer' });
  expect(tab.location.replace).not.toHaveBeenCalled();
  await browser.open(destination);
  expect(tab.location.replace).toHaveBeenCalledWith(destination);
  browser.close();
  expect(tab.close).not.toHaveBeenCalled();
});

it('closes the pending tab and prevents late navigation after cancellation', async () => {
  const { tab } = webTab();
  const browser = prepareDocumentBrowser();
  browser.close();
  await browser.open(destination);
  expect(tab.close).toHaveBeenCalledTimes(1);
  expect(tab.location.replace).not.toHaveBeenCalled();
});

it('reports popup blocking before authorization can start', () => {
  const { open } = webTab();
  open.mockReturnValueOnce(null as never);
  expect(prepareDocumentBrowser).toThrow('Allow pop-ups');
});

it('does not reopen a tab closed by the user', async () => {
  const { tab } = webTab();
  const browser = prepareDocumentBrowser();
  tab.closed = true;
  await browser.open(destination);
  expect(tab.location.replace).not.toHaveBeenCalled();
});

it.each(['ios', 'android'])('opens the exact URL in the external browser on %s', async (os) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await prepareDocumentBrowser().open(destination);
  expect(open).toHaveBeenCalledWith(destination);
});

it.each(['javascript:alert(1)', 'http://files.example/doc', 'https://user:pass@files.example/doc'])(
  'rejects unsafe navigation %s',
  async (url) => {
    const { tab } = webTab();
    await expect(prepareDocumentBrowser().open(url)).rejects.toThrow('Document link unavailable');
    expect(tab.location.replace).not.toHaveBeenCalled();
  }
);
