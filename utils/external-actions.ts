import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

export type ExternalActionResult = {
  ok: boolean;
  message?: string;
};

export async function openInAppBrowser(
  url: string | null | undefined,
  unavailableMessage = 'The link is unavailable right now.'
): Promise<ExternalActionResult> {
  if (!url) {
    return { ok: false, message: unavailableMessage };
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      return { ok: false, message: unavailableMessage };
    }

    await WebBrowser.openBrowserAsync(url);
    return { ok: true };
  } catch {
    return { ok: false, message: unavailableMessage };
  }
}
