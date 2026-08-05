import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { AppButton } from '@/components/app-button';
import { theme } from '@/constants/theme';

type DigitalCardShareActionsProps = {
  publicUrl: string;
  slug: string;
  onEdit: () => void;
};

export function DigitalCardShareActions({ publicUrl, slug, onEdit }: DigitalCardShareActionsProps) {
  const qrRef = useRef<View>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const copyLink = async () => {
    setError('');
    await Clipboard.setStringAsync(publicUrl);
    setNotice('Link copied.');
  };

  const shareCard = async () => {
    setError('');
    await Share.share({
      title: 'Digital business card',
      message: publicUrl,
      url: publicUrl,
    });
  };

  const shareQrImage = async () => {
    setError('');

    if (Platform.OS === 'web') {
      setError('QR image sharing is available in the native app.');
      return;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare || !qrRef.current) {
      setError('QR image sharing is not available on this device.');
      return;
    }

    const uri = await captureRef(qrRef, {
      format: 'png',
      quality: 1,
    });
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share QR code',
    });
  };

  return (
    <View style={styles.wrapper}>
      <View ref={qrRef} collapsable={false} style={styles.qrBox}>
        <QRCode value={publicUrl} size={164} color={theme.colors.primaryDeep} backgroundColor={theme.colors.white} />
        <Text style={styles.qrCaption}>Scan to open card</Text>
      </View>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        <AppButton label="Copy link" onPress={copyLink} />
        <AppButton label="Share card" variant="secondary" onPress={shareCard} />
        <AppButton label="Share QR image" variant="secondary" onPress={shareQrImage} />
        <AppButton
          label="Preview public card"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/card/[slug]',
              params: { slug, preview: '1' },
            })
          }
        />
        <AppButton label="Edit details" variant="ghost" onPress={onEdit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.md,
  },
  qrBox: {
    alignSelf: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  qrCaption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  noticeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.success,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
  actions: {
    gap: theme.spacing.xs,
  },
});
