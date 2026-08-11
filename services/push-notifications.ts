import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/services/supabase';

const PUSH_DEVICE_TABLE =
  process.env.EXPO_PUBLIC_SUPABASE_PUSH_DEVICE_TABLE?.trim() || 'portal_push_devices';

export type PushRegistrationResult =
  | {
      status: 'registered';
      message: string;
      token: string;
    }
  | {
      status: 'unsupported' | 'simulator' | 'permission-denied' | 'missing-project-id' | 'error';
      message: string;
      token: null;
    };

function notificationsAreAllowed(settings: Notifications.NotificationPermissionsStatus) {
  if (settings.granted) return true;

  const iosStatus = settings.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function getEasProjectId() {
  const configuredProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  const easProjectId = Constants.easConfig?.projectId;

  if (typeof configuredProjectId === 'string' && configuredProjectId.trim()) {
    return configuredProjectId.trim();
  }

  if (typeof easProjectId === 'string' && easProjectId.trim()) {
    return easProjectId.trim();
  }

  return null;
}

export async function savePushDeviceToken(expoPushToken: string) {
  const normalizedToken = expoPushToken.trim();
  if (!normalizedToken) {
    throw new Error('A valid Expo push token is required.');
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    throw new Error('The EAS project ID is missing from the Expo app configuration.');
  }

  const supabase = getSupabaseClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const user = data.user;
  const loginEmail = user?.email?.trim().toLowerCase();

  if (userError || !user || !loginEmail) {
    throw new Error('Sign in before saving this device for push notifications.');
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from(PUSH_DEVICE_TABLE).upsert(
    {
      user_id: user.id,
      login_email: loginEmail,
      expo_push_token: normalizedToken,
      platform: Platform.OS,
      project_id: projectId,
      device_name: Device.deviceName?.trim() || null,
      device_model: Device.modelName?.trim() || null,
      os_version: Device.osVersion?.trim() || null,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,expo_push_token' }
  );

  if (error) {
    throw new Error(`Unable to save this push-enabled device (${error.message}).`);
  }
}

export function configureForegroundNotificationHandling() {
  if (Platform.OS !== 'ios') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS !== 'ios') {
    return {
      status: 'unsupported',
      message: 'This first push-notification test is available on iPhone only.',
      token: null,
    };
  }

  if (!Device.isDevice) {
    return {
      status: 'simulator',
      message: 'Push notifications require a physical iPhone. Install the EAS development build on a device.',
      token: null,
    };
  }

  try {
    let permissions = await Notifications.getPermissionsAsync();

    if (!notificationsAreAllowed(permissions)) {
      permissions = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    }

    if (!notificationsAreAllowed(permissions)) {
      return {
        status: 'permission-denied',
        message: 'Notification permission is off. Enable notifications for this app in iPhone Settings and reopen Account.',
        token: null,
      };
    }

    const projectId = getEasProjectId();
    if (!projectId) {
      return {
        status: 'missing-project-id',
        message: 'The EAS project ID is missing from the Expo app configuration.',
        token: null,
      };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    return {
      status: 'registered',
      message: 'Ready. Copy this token into the Expo Push Notification Tool.',
      token,
    };
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
    return {
      status: 'error',
      message: `Unable to register this iPhone for push notifications.${detail}`,
      token: null,
    };
  }
}
