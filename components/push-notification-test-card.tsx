import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { theme } from '@/constants/theme';
import {
  type PushRegistrationResult,
  registerForPushNotifications,
  savePushDeviceToken,
} from '@/services/push-notifications';

type PushNotificationTestCardProps = {
  isDesktopLayout?: boolean;
};

export function PushNotificationTestCard({ isDesktopLayout = false }: PushNotificationTestCardProps) {
  const [result, setResult] = useState<PushRegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'ios') return;

    let active = true;

    void registerForPushNotifications().then(async (nextResult) => {
      if (!active) return;
      setResult(nextResult);

      if (!nextResult.token) return;

      try {
        await savePushDeviceToken(nextResult.token);
        if (active) {
          setPersistenceMessage('Saved to Supabase for this signed-in customer.');
        }
      } catch (error) {
        if (active) {
          setPersistenceMessage(
            error instanceof Error ? error.message : 'Unable to save this push-enabled device.'
          );
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!__DEV__ || Platform.OS !== 'ios') return null;

  const copyToken = async () => {
    if (!result?.token) return;
    await Clipboard.setStringAsync(result.token);
    setCopied(true);
  };

  return (
    <View style={[styles.card, isDesktopLayout ? styles.desktopCard : null]}>
      <Text style={styles.eyebrow}>Development Only</Text>
      <Text style={styles.title}>Push Test</Text>
      <Text style={styles.description}>
        {result?.message ?? 'Requesting notification permission and registering this iPhone...'}
      </Text>
      {persistenceMessage ? <Text style={styles.persistence}>{persistenceMessage}</Text> : null}

      {result?.token ? (
        <>
          <Text selectable style={styles.token} testID="expo-push-token">
            {result.token}
          </Text>
          <AppButton
            label={copied ? 'Token Copied' : 'Copy Token'}
            variant="secondary"
            onPress={() => {
              void copyToken();
            }}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  desktopCard: {
    borderColor: '#CBDAD4',
  },
  eyebrow: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  persistence: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
  },
  token: {
    ...theme.typography.mono,
    color: theme.colors.textStrong,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.backgroundSoft,
    padding: theme.spacing.sm,
  },
});
