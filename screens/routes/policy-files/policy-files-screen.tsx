import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import {
  fetchPolicyFilesList,
  fetchPolicyFilesListByInsuredId,
  fetchPolicyFilesListByPolicy,
} from '@/services/policy-files-api';
import { PolicyFileEntry } from '@/types/policy-file';
import { openInAppBrowser } from '@/utils/external-actions';
import { formatIsoDateTime } from '@/utils/format';
import {
  hasVisiblePolicyDocumentName,
  matchesSelectedPolicyFile,
  sortPolicyFilesNewestFirst,
} from '@/utils/policy-files';

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

async function collectVisibleFilesFromEntries({
  entries,
  insuredId,
  selectedPolicyId,
  selectedPolicyNumber,
  visitedFolderIds,
}: {
  entries: PolicyFileEntry[];
  insuredId: string;
  selectedPolicyId: string;
  selectedPolicyNumber: string;
  visitedFolderIds: Set<string>;
}): Promise<PolicyFileEntry[]> {
  const visibleFiles = entries.filter(
    (entry) =>
      entry.fileOrFolder === 'File' &&
      hasVisiblePolicyDocumentName(entry.name) &&
      matchesSelectedPolicyFile(entry, selectedPolicyId, selectedPolicyNumber)
  );

  const nestedFiles = await Promise.all(
    entries
      .filter((entry) => entry.fileOrFolder === 'Folder')
      .map(async (entry) => {
        const folderId = entry.databaseId.trim();
        const folderPolicyId = entry.policyId?.trim() || selectedPolicyId;
        const folderInsuredId = entry.insuredId?.trim() || insuredId;

        if (!folderId || !folderPolicyId || !folderInsuredId || visitedFolderIds.has(folderId)) {
          return [];
        }

        visitedFolderIds.add(folderId);
        const response = await fetchPolicyFilesList({
          insuredId: folderInsuredId,
          policyId: folderPolicyId,
          folderId,
        });

        return collectVisibleFilesFromEntries({
          entries: response.data,
          insuredId: folderInsuredId,
          selectedPolicyId: folderPolicyId,
          selectedPolicyNumber,
          visitedFolderIds,
        });
      })
  );

  return sortPolicyFilesNewestFirst([...visibleFiles, ...nestedFiles.flat()]);
}

export default function PolicyFilesScreen() {
  const { insuredId, policyId, policyNumber } = useLocalSearchParams<{
    insuredId?: string | string[];
    policyId?: string | string[];
    policyNumber?: string | string[];
  }>();
  const { customer } = useAuth();
  const [files, setFiles] = useState<PolicyFileEntry[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insuredLookupId = useMemo(() => {
    const fromParams = readSearchParam(insuredId).trim();
    if (fromParams) return fromParams;
    const fromDatabaseId = customer?.databaseId?.trim();
    if (fromDatabaseId) return fromDatabaseId;
    return customer?.insuredId?.trim() || '';
  }, [customer?.databaseId, customer?.insuredId, insuredId]);
  const selectedPolicyId = useMemo(() => readSearchParam(policyId).trim(), [policyId]);
  const selectedPolicyNumber = useMemo(() => readSearchParam(policyNumber).trim(), [policyNumber]);

  const loadFiles = useCallback(async () => {
    if (!insuredLookupId) {
      setFiles([]);
      setError('No insured id is available for this account.');
      setIsLoadingInitial(false);
      return;
    }

    setError(null);

    const rootResponse = selectedPolicyId
      ? await fetchPolicyFilesListByPolicy({
          insuredId: insuredLookupId,
          policyId: selectedPolicyId,
        })
      : await fetchPolicyFilesListByInsuredId(insuredLookupId);

    const visibleFiles = await collectVisibleFilesFromEntries({
      entries: rootResponse.data,
      insuredId: insuredLookupId,
      selectedPolicyId,
      selectedPolicyNumber,
      visitedFolderIds: new Set<string>(),
    });

    setFiles(visibleFiles);
  }, [insuredLookupId, selectedPolicyId, selectedPolicyNumber]);

  useEffect(() => {
    let isMounted = true;

    const hydrateFiles = async () => {
      setIsLoadingInitial(true);
      try {
        await loadFiles();
      } catch (nextError) {
        if (!isMounted) return;
        setFiles([]);
        setError(toUserFacingError(nextError));
      } finally {
        if (isMounted) {
          setIsLoadingInitial(false);
        }
      }
    };

    void hydrateFiles();

    return () => {
      isMounted = false;
    };
  }, [loadFiles]);

  const refreshFiles = useCallback(async () => {
    if (!insuredLookupId) return;

    setIsRefreshing(true);
    setError(null);
    try {
      await loadFiles();
    } catch (nextError) {
      const message = toUserFacingError(nextError);
      if (files.length === 0) {
        setError(message);
      } else {
        Alert.alert('Unable to refresh', message);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [files.length, insuredLookupId, loadFiles]);

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
    const createdAtLabel = formatIsoDateTime(item.createDate);

    return (
      <Pressable
        onPress={() => {
          void handleFilePress(item);
        }}
        style={({ pressed }) => [styles.itemCard, pressed ? styles.pressed : null]}>
        <View style={styles.itemTop}>
          <View style={styles.itemIconWrap}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.policyNumber ? <Text style={styles.itemMeta}>Policy #: {item.policyNumber}</Text> : null}
            <Text style={styles.itemMeta}>By: {item.creatorName ?? 'Unknown'}</Text>
            <Text style={styles.itemMeta}>Created: {createdAtLabel}</Text>
          </View>
          <Ionicons name="document-attach-outline" size={18} color={theme.colors.textSubtle} />
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

  if (isLoadingInitial) {
    return (
      <ScreenContainer>
        <LoadingState title="Loading policy files" description="Retrieving available policy documents." />
      </ScreenContainer>
    );
  }

  if (error && files.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="warning-outline"
          title="Unable to load policy files"
          description={error}
          actionLabel="Retry"
          onAction={() => {
            void refreshFiles();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <SectionHeader
        title="Policy Files"
        subtitle={
          selectedPolicyNumber
            ? `Available documents for policy ${selectedPolicyNumber}`
            : 'Available policy documents'
        }
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.listCard}>
        <FlatList
          data={files}
          keyExtractor={(item) => item.databaseId}
          renderItem={renderRow}
          onRefresh={() => {
            void refreshFiles();
          }}
          refreshing={isRefreshing}
          contentContainerStyle={files.length === 0 ? styles.emptyListContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No documents available"
              description="There are no visible policy documents available for this policy yet."
              actionLabel="Refresh"
              onAction={() => {
                void refreshFiles();
              }}
            />
          }
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
