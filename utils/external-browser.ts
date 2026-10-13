import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Platform } from 'react-native';

import { isExternalFinancingUrl } from '@/utils/premium-payment';

/** Call directly from a web tap, after eligibility has been checked. Never log the URL. */
export async function openExternalBrowser(url: string): Promise<void> {
  if (!isExternalFinancingUrl(url)) throw new Error('The carrier website is unavailable.');
  if (Platform.OS === 'web') {
    // A blank same-origin tab lets us detect popup blocking before navigating.
    const tab = window.open('about:blank', '_blank');
    if (!tab) throw new Error('The browser could not open a new tab.');
    try {
      tab.opener = null;
      const referrer = tab.document.createElement('meta');
      referrer.name = 'referrer';
      referrer.content = 'no-referrer';
      tab.document.head.appendChild(referrer);
      tab.location.replace(url);
    } catch {
      tab.close();
      throw new Error('The browser could not open the carrier website.');
    }
    return;
  }
  await openBrowserAsync(url, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
}
