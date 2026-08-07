import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { DigitalCardPreview } from '@/components/digital-card/digital-card-preview';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { getPublishedDigitalBusinessCardBySlug } from '@/services/digital-card-api';
import type { DigitalBusinessCard } from '@/types/digital-card';
import {
  buildDigitalCardPrimaryActionUrl,
  buildDigitalCardPublicUrl,
  downloadDigitalCardVCard,
} from '@/utils/digital-card-links';
import { buildEmailLink, buildPhoneLink, buildSmsLink, openExternalLink, openInAppBrowser } from '@/utils/external-actions';

function toContact(card: DigitalBusinessCard, publicUrl: string): Contacts.Contact {
  return {
    contactType: Contacts.ContactTypes.Person,
    name: card.fullName,
    company: card.company,
    jobTitle: card.title,
    phoneNumbers: card.phone ? [{ label: 'work', number: card.phone, isPrimary: true }] : [],
    emails: card.email ? [{ label: 'work', email: card.email, isPrimary: true }] : [],
    urlAddresses: [
      { label: 'Digital card', url: publicUrl },
      ...(card.website ? [{ label: 'Website', url: card.website }] : []),
    ],
  };
}

export default function PublicDigitalCardScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[]; preview?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const preview = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const [card, setCard] = useState<DigitalBusinessCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const publicUrl = useMemo(() => (slug ? buildDigitalCardPublicUrl(slug) : ''), [slug]);

  useEffect(() => {
    let mounted = true;

    const loadCard = async () => {
      if (!slug) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const nextCard = await getPublishedDigitalBusinessCardBySlug(slug);
        if (mounted) setCard(nextCard);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadCard();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const openLink = async (target: string | null) => {
    setError('');
    const result = await openExternalLink(target);
    if (!result.ok) setError(result.message ?? 'Unable to open this action right now.');
  };

  const saveToContacts = async () => {
    if (!card) return;
    setError('');
    setNotice('');

    if (Platform.OS === 'web') {
      downloadDigitalCardVCard(card, publicUrl);
      setNotice('Contact file downloaded.');
      return;
    }

    try {
      await Contacts.presentFormAsync(null, toContact(card, publicUrl), { isNew: true });
      setNotice('Contact form opened.');
    } catch {
      setError('Unable to open the contact form on this device.');
    }
  };

  const shareCard = async () => {
    if (!card) return;
    setError('');
    setNotice('');

    try {
      await Share.share({
        title: `${card.company} digital business card`,
        message: publicUrl,
        url: publicUrl,
      });
    } catch {
      setError('Unable to open sharing right now.');
    }
  };

  const showPreviewBack = preview === '1';
  const handlePreviewBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/digital-card');
  };

  const previewBackButton = showPreviewBack ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to digital business card sharing"
      onPress={handlePreviewBack}
      style={({ pressed }) => [styles.previewBackButton, pressed ? styles.previewBackPressed : null]}>
      <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
      <Text style={styles.previewBackText}>Back to share</Text>
    </Pressable>
  ) : null;

  if (isLoading) {
    return (
      <ScreenContainer scroll={false}>
        {previewBackButton}
        <LoadingState title="Loading card" description="Opening this digital business card." />
      </ScreenContainer>
    );
  }

  if (!card) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Card not found' }} />
        {previewBackButton}
        <View style={styles.notFoundCard}>
          <Text style={styles.notFoundTitle}>Card not found</Text>
          <Text style={styles.notFoundText}>
            This Insure Probuilders card is not published or the link is no longer available.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxContentWidth={640}>
      <Stack.Screen
        options={{
          title: `${card.fullName} | ${card.company}`,
        }}
      />
      {previewBackButton}
      <DigitalCardPreview
        card={card}
        interactive
        onCall={() => openLink(buildPhoneLink(card.phone))}
        onText={() => openLink(buildSmsLink(card.phone))}
        onEmail={() => openLink(buildEmailLink(card.email, { subject: `Question for ${card.company}` }))}
        onWebsite={() => void openInAppBrowser(card.website)}
        onPrimaryAction={() => openLink(buildDigitalCardPrimaryActionUrl(card, publicUrl))}
        onSaveContact={saveToContacts}
        onShareCard={shareCard}
      />

      <View style={styles.actions}>
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  previewBackButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadows.surface,
  },
  previewBackPressed: {
    opacity: 0.82,
  },
  previewBackText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  actions: {
    gap: theme.spacing.xs,
  },
  noticeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.success,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
  notFoundCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  notFoundTitle: {
    ...theme.typography.h2,
    color: theme.colors.textStrong,
  },
  notFoundText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
