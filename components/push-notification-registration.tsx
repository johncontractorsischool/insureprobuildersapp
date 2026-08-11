import { useEffect } from 'react';

import { useAuth } from '@/context/auth-context';
import {
  registerForPushNotifications,
  savePushDeviceToken,
} from '@/services/push-notifications';

export function PushNotificationRegistration() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) return;

    let active = true;

    const registerAndSave = async () => {
      const registration = await registerForPushNotifications();
      if (!active || !registration.token) return;

      try {
        await savePushDeviceToken(registration.token);
      } catch {
        // Retry on the next signed-in app launch without interrupting the
        // customer's authenticated app experience.
      }
    };

    void registerAndSave();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoadingAuth]);

  return null;
}
