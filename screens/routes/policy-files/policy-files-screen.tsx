import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { fetchPolicyFilesList, fetchPolicyFilesListByInsuredId } from '@/services/policy-files-api';
import { PolicyFileEntry } from '@/types/policy-file';
import { openInAppBrowser } from '@/utils/external-actions';
import { formatIsoDateTime } from '@/utils/format';

type FolderLevel = {
  id: string;
  name: string;
  policyId: string | null;
  folderId: string | null;
  items: PolicyFileEntry[];
};

function toUserFacingError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to load policy files right now.';
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function getFileUrl(item: PolicyFileEntry) {
  return item.fileUrl ?? item.downloadUrl ?? item.url;
}

export default function PolicyFilesScreen() {
  const { insuredId, policyId, policyNumber } = useLocalSearchParams<{
    insuredId?: string | string[];
    policyId?: string | string[];
    policyNumber?: string | string[];
  }>();
  const { customer } = useAuth();
  const [levels, setLevels] = useState<FolderLevel[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const insuredLookupId = useMemo(() => {
    const fromParams = readSearchParam(insuredId).trim();
    if (fromParams) return fromParams;
    const fromDatabaseId = customer?.databaseId?.trim();
    if (fromDatabaseId) return fromDatabaseId;
    return customer?.insuredId?.trim() || '';
  }, [customer?.databaseId, customer?.insuredId, insuredId]);
  const selectedPolicyId = useMemo(() => readSearchParam(policyId).trim(), [policyId]);
  const selectedPolicyNumber = useMemo(
    () => readSearchParam(policyNumber).trim(),
    [policyNumber]
  );

  const filterEntriesForPolicy = useCallback(
    (entries: PolicyFileEntry[]) => {
      if (!selectedPolicyId && !selectedPolicyNumber) return entries;

      return entries.filter((entry) => {
        const entryPolicyId = entry.policyId?.trim() || '';
        const entryPolicyNumber = entry.policyNumber?.trim() || '';

        if (selectedPolicyId && entryPolicyId) {
          return entryPolicyId === selectedPolicyId;
        }

        if (selectedPolicyNumber && entryPolicyNumber) {
          return entryPolicyNumber === selectedPolicyNumber;
        }

        return false;
      });
    },
    [selectedPolicyId, selectedPolicyNumber]
  );

  const currentLevel = levels[levels.length - 1] ?? null;
  const currentItems = currentLevel?.items ?? [];

  const loadRoot = useCallback(async () => {
    if (!insuredLookupId) {
      setLevels([]);
      setError('No insured id is available for this account.');
      setIsLoadingInitial(false);
      return;
    }

    setIsLoadingInitial(true);
    setError(null);
    try {
      const response = await fetchPolicyFilesListByInsuredId(insuredLookupId);
      const filteredRootItems = filterEntriesForPolicy(response.data);
      setLevels([
        {
          id: 'root',
          name: 'Root',
          policyId: null,
          folderId: null,
          items: filteredRootItems,
        },
      ]);
    } catch (nextError) {
      setLevels([]);
      setError(toUserFacingError(nextError));
    } finally {
      setIsLoadingInitial(false);
    }
  }, [filterEntriesForPolicy, insuredLookupId]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  const openFolder = useCallback(
    async (item: PolicyFileEntry) => {
      const folderId = item.databaseId.trim();
      const policyId = item.policyId?.trim() || '';
      const folderInsuredId = item.insuredId?.trim() || insuredLookupId;

      if (!folderId || !policyId || !folderInsuredId) {
        Alert.alert('Folder unavailable', 'This folder is missing required identifiers.');
        return;
      }

      setLoadingFolderId(item.databaseId);
      setError(null);
      try {
        const response = await fetchPolicyFilesList({
          insuredId: folderInsuredId,
          policyId,
          folderId,
        });
        setLevels((previous) => [
          ...previous,
          {
            id: item.databaseId,
            name: item.name,
            policyId,
            folderId,
            items: response.data,
          },
        ]);
      } catch (nextError) {
        Alert.alert('Unable to open folder', toUserFacingError(nextError));
      } finally {
        setLoadingFolderId(null);
      }
    },
    [insuredLookupId]
  );

  const refreshCurrentLevel = useCallback(async () => {
    if (!insuredLookupId) return;

    setIsRefreshing(true);
    setError(null);
    try {
      if (!currentLevel || currentLevel.id === 'root') {
        const response = await fetchPolicyFilesListByInsuredId(insuredLookupId);
        const filteredRootItems = filterEntriesForPolicy(response.data);
        setLevels([
          {
            id: 'root',
            name: 'Root',
            policyId: null,
            folderId: null,
            items: filteredRootItems,
          },
        ]);
      } else {
        const folderId = currentLevel.folderId?.trim() || currentLevel.id;
        const policyId = currentLevel.policyId?.trim() || '';
        if (!folderId || !policyId) {
          throw new Error('This folder is missing required identifiers.');
        }

        const response = await fetchPolicyFilesList({
          insuredId: insuredLookupId,
          policyId,
          folderId,
        });

        setLevels((previous) => {
          if (previous.length === 0) return previous;
          return previous.map((level, index) =>
            index === previous.length - 1
              ? {
                  ...level,
                  items: response.data,
                }
              : level
          );
        });
      }
    } catch (nextError) {
      const message = toUserFacingError(nextError);
      if (currentItems.length === 0) {
        setError(message);
      } else {
        Alert.alert('Unable to refresh', message);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [currentItems.length, currentLevel, filterEntriesForPolicy, insuredLookupId]);

  const jumpToLevel = (index: number) => {
    setLevels((previous) => previous.slice(0, index + 1));
    setError(null);
  };

  const goBackLevel = () => {
    setLevels((previous) => previous.slice(0, previous.length - 1));
    setError(null);
  };

  const handleFilePress = useCallback(async (item: PolicyFileEntry) => {
    const fileUrl = getFileUrl(item);
    if (!fileUrl) {
      Alert.alert('File action', 'TODO: file preview/download');
      return;
    }

    const result = await openInAppBrowser(fileUrl, 'File link is not available.');
    if (!result.ok) {
      Alert.alert('Unable to open file', result.message ?? 'File link is not available.');
    }
  }, []);

  const renderRow = ({ item }: { item: PolicyFileEntry }) => {
    const isFolder = item.fileOrFolder === 'Folder';
    const isOpeningFolder = loadingFolderId === item.databaseId;
    const createdAtLabel = formatIsoDateTime(item.createDate);

    return (
      <Pressable
        onPress={() => {
          if (isFolder) {
            void openFolder(item);
            return;
          }
          void handleFilePress(item);
        }}
        style={({ pressed }) => [styles.itemCard, pressed ? styles.pressed : null]}>
        <View style={styles.itemTop}>
          <View style={styles.itemIconWrap}>
            <Ionicons
              name={isFolder ? 'folder-open-outline' : 'document-text-outline'}
              size={20}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>Policy #: {item.policyNumber ?? 'Not provided'}</Text>
            <Text style={styles.itemMeta}>By: {item.creatorName ?? 'Unknown'}</Text>
            <Text style={styles.itemMeta}>Created: {createdAtLabel}</Text>
          </View>
          {isFolder ? (
            isOpeningFolder ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
            )
          ) : (
            <Ionicons name="document-attach-outline" size={18} color={theme.colors.textSubtle} />
          )}
        </View>
      </Pressable>
    );
  };

  if (!insuredLookupId) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="warning-outline"
          title="Missing insured id"
          description="We could not find an insured id to load policy files for this account."
        />
      </ScreenContainer>
    );
  }

  if (isLoadingInitial && !currentLevel) {
    return (
      <ScreenContainer>
        <LoadingState title="Loading policy files" description="Retrieving folders and file records." />
      </ScreenContainer>
    );
  }

  if (error && !currentLevel) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="warning-outline"
          title="Unable to load policy files"
          description={error}
          actionLabel="Retry"
          onAction={() => {
            void loadRoot();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <SectionHeader
        title="Policy files"
        subtitle={
          currentLevel
            ? `Browsing: ${currentLevel.name}${selectedPolicyNumber ? ` • Policy ${selectedPolicyNumber}` : ''}`
            : 'Browse folders and policy files'
        }
      />

      <View style={styles.breadcrumbWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbScroll}>
          {levels.map((level, index) => (
            <Pressable
              key={`${level.id}-${index}`}
              onPress={() => jumpToLevel(index)}
              style={({ pressed }) => [styles.crumb, pressed ? styles.pressed : null]}>
              <Text style={[styles.crumbText, index === levels.length - 1 ? styles.crumbTextActive : null]}>
                {level.name}
              </Text>
              {index < levels.length - 1 ? (
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textSubtle} />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        {levels.length > 1 ? (
          <Pressable onPress={goBackLevel} style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}>
            <Ionicons name="arrow-back" size={15} color={theme.colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.listCard}>
        <FlatList
          data={currentItems}
          keyExtractor={(item) => item.databaseId}
          renderItem={renderRow}
          onRefresh={() => {
            void refreshCurrentLevel();
          }}
          refreshing={isRefreshing}
          contentContainerStyle={currentItems.length === 0 ? styles.emptyListContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="folder-open-outline"
              title="No files found"
              description="There are no files or folders available at this level yet."
              actionLabel="Refresh"
              onAction={() => {
                void refreshCurrentLevel();
              }}
            />
          }
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  breadcrumbWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  breadcrumbScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.xs,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 7,
  },
  crumbText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  crumbTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 7,
    backgroundColor: theme.colors.surface,
  },
  backButtonText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  listCard: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadows.surface,
  },
  listContent: {
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  emptyListContent: {
    padding: theme.spacing.sm,
    minHeight: 320,
    justifyContent: 'center',
  },
  itemCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.sm,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  itemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCopy: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  itemMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  pressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.94,
  },
});
