import { Linking, Platform } from 'react-native';

export type DocumentBrowser = { open: (url: string) => Promise<void>; close: () => void };

/** Reserve a web tab during the tap, before awaiting document authorization. */
export function prepareDocumentBrowser(): DocumentBrowser {
  const tab = Platform.OS === 'web' ? window.open('about:blank', '_blank') : null;
  if (Platform.OS === 'web' && !tab) throw new Error('Allow pop-ups to open a document tab.');
  let cancelled = false;
  let opened = false;
  const close = () => {
    cancelled = true;
    if (!opened) tab?.close();
  };
  try {
    if (tab) {
      tab.opener = null;
      const meta = tab.document.createElement('meta');
      meta.name = 'referrer';
      meta.content = 'no-referrer';
      tab.document.head.appendChild(meta);
    }
  } catch {
    close();
    throw new Error('Unable to prepare a document tab.');
  }
  return {
    close,
    async open(url) {
      if (cancelled || tab?.closed) return;
      const destination = new URL(url);
      if (destination.protocol !== 'https:' || destination.username || destination.password) {
        throw new Error('Document link unavailable.');
      }
      if (tab) tab.location.replace(url);
      else await Linking.openURL(url);
      opened = true;
    },
  };
}
