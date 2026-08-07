import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { theme } from '@/constants/theme';
import { useDigitalCard } from '@/context/digital-card-context';

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(value)
    );
  } catch {
    return null;
  }
}

export function DigitalCardEntryPanel({ isDesktopLayout = false }: { isDesktopLayout?: boolean }) {
  const { card, hasDraft, isLoading, error, refresh } = useDigitalCard();
  const isLive = card?.status === 'published';
  const statusLabel = isLive ? 'Live' : hasDraft ? 'Draft' : 'Not set up';
  const updatedAt = formatUpdatedAt(card?.updatedAt);

  return (
    <View style={[styles.panel, isDesktopLayout ? styles.desktopPanel : null]}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons name="id-card-outline" size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Digital business card</Text>
          <Text style={styles.description}>Create a shareable profile clients can open from a QR code.</Text>
        </View>
        <View
          accessibilityLabel={`Digital business card status: ${statusLabel}`}
          style={[styles.statusChip, isLive ? styles.statusLive : hasDraft ? styles.statusDraft : null]}>
          <Text style={[styles.statusText, isLive ? styles.statusTextLive : null]}>{statusLabel}</Text>
        </View>
      </View>

      {updatedAt ? <Text style={styles.updatedText}>Last updated {updatedAt}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        <AppButton
          label={card || hasDraft ? 'Manage card' : 'Create card'}
          variant="secondary"
          loading={isLoading}
          onPress={() => router.push('/digital-card')}
        />
        {error ? <AppButton label="Retry" variant="ghost" onPress={() => void refresh()} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  desktopPanel: {
    borderColor: '#CBDAD4',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xxs,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  statusChip: {
    minHeight: 30,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundSoft,
    paddingHorizontal: theme.spacing.sm,
    justifyContent: 'center',
  },
  statusDraft: {
    backgroundColor: '#FFF8E7',
    borderColor: '#EAD8A4',
  },
  statusLive: {
    backgroundColor: '#E8F6EF',
    borderColor: '#BFE1CE',
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  statusTextLive: {
    color: theme.colors.success,
  },
  updatedText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
  actions: {
    gap: theme.spacing.xs,
  },
});
