import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import type { DigitalBusinessCard, DigitalCardDraft } from '@/types/digital-card';
import { getAccessibleForegroundColor, getDigitalCardPrimaryColor } from '@/utils/digital-card-branding';
import { getPrimaryActionLabel } from '@/utils/digital-card-links';

type PreviewCard = DigitalBusinessCard | DigitalCardDraft;

type DigitalCardPreviewProps = {
  card: PreviewCard;
  interactive?: boolean;
  onCall?: () => void;
  onText?: () => void;
  onEmail?: () => void;
  onWebsite?: () => void;
  onPrimaryAction?: () => void;
  onSaveContact?: () => void;
  onShareCard?: () => void;
};

function getInitials(card: PreviewCard) {
  const source = card.company || card.fullName || 'IP';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getImageUri(card: PreviewCard) {
  if ('localImageUri' in card && card.localImageUri) return card.localImageUri;
  return card.imageUrl;
}

function normalizeDisplayValue(value: string) {
  return value.trim().toLowerCase();
}

function shouldShowContactName(card: PreviewCard) {
  const fullName = normalizeDisplayValue(card.fullName);
  const company = normalizeDisplayValue(card.company);
  return Boolean(fullName && fullName !== company);
}

function QuickAction({
  icon,
  label,
  brandColor,
  interactive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  brandColor: string;
  interactive: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!interactive || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        { borderColor: `${brandColor}33` },
        pressed && interactive ? styles.actionPressed : null,
      ]}>
      <Ionicons name={icon} size={18} color={brandColor} />
      <Text style={[styles.quickActionLabel, { color: brandColor }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryAction,
        pressed ? styles.actionPressed : null,
      ]}>
      <Ionicons name={icon} size={18} color={theme.colors.primaryDeep} />
      <Text style={styles.secondaryActionLabel}>{label}</Text>
    </Pressable>
  );
}

function TrustDetails({ card }: { card: PreviewCard }) {
  const details = [
    card.cslbLicenseNumber ? `CSLB #${card.cslbLicenseNumber}` : null,
    card.licenseClassification ? card.licenseClassification : null,
    card.cslbLicenseNumber ? 'Licensed Contractor' : null,
    card.serviceArea ? `Serving ${card.serviceArea}` : null,
  ].filter((item): item is string => Boolean(item));

  if (details.length === 0) return null;

  return (
    <View style={styles.trustSection}>
      {details.map((detail) => (
        <View key={detail} style={styles.trustPill}>
          <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.trustText}>{detail}</Text>
        </View>
      ))}
    </View>
  );
}

export function DigitalCardPreview({
  card,
  interactive = false,
  onCall,
  onText,
  onEmail,
  onWebsite,
  onPrimaryAction,
  onSaveContact,
  onShareCard,
}: DigitalCardPreviewProps) {
  const imageUri = getImageUri(card);
  const brandColor = getDigitalCardPrimaryColor(card.primaryColor);
  const foregroundColor = getAccessibleForegroundColor(brandColor);
  const hasPhone = Boolean(card.phone.trim());
  const hasEmail = Boolean(card.email.trim());
  const hasWebsite = Boolean(card.website.trim());
  const hasContactName = shouldShowContactName(card);
  const shouldShowQuickCall = hasPhone && card.primaryAction !== 'call';
  const shouldShowSecondaryActions = Boolean(onSaveContact || onShareCard);

  return (
    <View style={styles.card}>
      <View style={[styles.brandHeader, { backgroundColor: brandColor }]}>
        <View style={[styles.headerShape, { backgroundColor: foregroundColor }]} />
        <Text style={[styles.headerKicker, { color: foregroundColor }]}>Digital business card</Text>
      </View>

      <View style={styles.logoWrap}>
        <View style={styles.logoSurface}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.logoImage} contentFit="contain" />
          ) : (
            <View style={[styles.initialsFallback, { backgroundColor: `${brandColor}14` }]}>
              <Text style={[styles.initialsText, { color: brandColor }]}>{getInitials(card)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={styles.companyName}>{card.company || 'Company name'}</Text>
        {hasContactName ? <Text style={styles.contactName}>{card.fullName}</Text> : null}
        {card.title ? <Text style={styles.title}>{card.title}</Text> : null}
        {card.cslbLicenseNumber ? <Text style={styles.licenseLine}>CSLB #{card.cslbLicenseNumber}</Text> : null}
        {card.licenseClassification ? (
          <Text style={styles.licenseLine}>{card.licenseClassification}</Text>
        ) : null}
        {card.serviceArea ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.locationText}>{card.serviceArea}</Text>
          </View>
        ) : null}
      </View>

      {card.bio ? <Text style={styles.bio}>{card.bio}</Text> : null}

      <TrustDetails card={card} />

      <View style={styles.quickActions}>
        {shouldShowQuickCall ? (
          <QuickAction
            icon="call-outline"
            label="Call"
            brandColor={brandColor}
            interactive={interactive}
            onPress={onCall}
          />
        ) : null}
        {hasPhone ? (
          <QuickAction
            icon="chatbubble-outline"
            label="Text"
            brandColor={brandColor}
            interactive={interactive}
            onPress={onText}
          />
        ) : null}
        {hasEmail ? (
          <QuickAction
            icon="mail-outline"
            label="Email"
            brandColor={brandColor}
            interactive={interactive}
            onPress={onEmail}
          />
        ) : null}
        {hasWebsite ? (
          <QuickAction
            icon="globe-outline"
            label="Website"
            brandColor={brandColor}
            interactive={interactive}
            onPress={onWebsite}
          />
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={getPrimaryActionLabel(card.primaryAction)}
        disabled={!interactive || !onPrimaryAction}
        onPress={onPrimaryAction}
        style={({ pressed }) => [
          styles.primaryAction,
          { backgroundColor: brandColor },
          pressed && interactive ? styles.actionPressed : null,
        ]}>
        <Text style={[styles.primaryActionText, { color: foregroundColor }]}>
          {getPrimaryActionLabel(card.primaryAction)}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={foregroundColor} />
      </Pressable>

      {shouldShowSecondaryActions ? (
        <View style={styles.secondaryActions}>
          {onSaveContact ? (
            <SecondaryAction icon="person-add-outline" label="Save Contact" onPress={onSaveContact} />
          ) : null}
          {onShareCard ? <SecondaryAction icon="share-outline" label="Share Card" onPress={onShareCard} /> : null}
        </View>
      ) : null}

      <Text style={styles.footer}>Powered by Pro-builders Insurance Agency</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadows.elevated,
  },
  brandHeader: {
    minHeight: 112,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    overflow: 'hidden',
  },
  headerShape: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    right: -68,
    top: -76,
    opacity: 0.08,
  },
  headerKicker: {
    ...theme.typography.caption,
    textTransform: 'uppercase',
  },
  logoWrap: {
    marginTop: -44,
    paddingHorizontal: theme.spacing.lg,
  },
  logoSurface: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.surface,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  initialsFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    ...theme.typography.h2,
    fontWeight: '800',
  },
  identity: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  companyName: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  contactName: {
    ...theme.typography.body,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  title: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  licenseLine: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingTop: theme.spacing.xs,
  },
  locationText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flex: 1,
  },
  bio: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  trustSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  trustPill: {
    minHeight: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  trustText: {
    ...theme.typography.caption,
    color: theme.colors.primaryDeep,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  quickAction: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceTint,
    paddingHorizontal: theme.spacing.sm,
    flexGrow: 1,
    flexBasis: '22%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
  },
  quickActionLabel: {
    ...theme.typography.caption,
    fontWeight: '800',
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  primaryActionText: {
    ...theme.typography.body,
    fontWeight: '800',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  secondaryActionLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.primaryDeep,
    fontWeight: '800',
  },
  actionPressed: {
    opacity: 0.82,
  },
  footer: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
});
