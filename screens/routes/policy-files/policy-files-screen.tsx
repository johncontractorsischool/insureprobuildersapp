import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePolicyDocuments } from '@/hooks/use-policy-documents';
import type { PolicyFileEntry } from '@/types/policy-file';
import { DocumentViewer } from '@/components/document-viewer';
import { formatIsoDateTime } from '@/utils/format';
import { sameExternalId } from '@/utils/policy-files';

function param(value: string | string[] | undefined) {
  return (Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
}

type Folder = { id: string; name: string; policyId: string };

export default function PolicyFilesScreen() {
  const params = useLocalSearchParams<{
    accountId?: string | string[];
    policyId?: string | string[];
    policyNumber?: string | string[];
  }>();
  const { customer, userEmail } = useAuth();
  const accountId = customer?.accountId?.trim() || customer?.databaseId?.trim() || '';
  const routeAccount = param(params.accountId);
  const policyId = param(params.policyId);
  const policyNumber = param(params.policyNumber);
  const scopeError =
    routeAccount && !sameExternalId(routeAccount, accountId)
      ? 'The selected account changed. Return to Policies and select your policy again.'
      : null;
  const rootScope = JSON.stringify([accountId, userEmail, routeAccount, policyId, policyNumber]);
  const [navigation, setNavigation] = useState<{ scope: string; folders: Folder[] }>({
    scope: rootScope,
    folders: [],
  });
  const folders = navigation.scope === rootScope ? navigation.folders : [];
  const folder = folders[folders.length - 1];
  const documents = usePolicyDocuments({
    accountId,
    policyId: policyId || folder?.policyId || '',
    policyNumber,
    folderId: folder?.id,
    userEmail,
    scopeError,
  });
  const [selected, setSelected] = useState<{ scope: string; file: PolicyFileEntry } | null>(null);
  const closeViewer = useCallback(() => setSelected(null), []);
  useFocusEffect(useCallback(() => closeViewer, [closeViewer, documents.scope]));
  const selectedFile =
    selected?.scope === documents.scope && !documents.error ? selected.file : null;
  const refresh = () => {
    closeViewer();
    void documents.refresh();
  };

  const renderRow = ({ item }: { item: PolicyFileEntry }) => {
    const isFolder = item.fileOrFolder === 'Folder';
    const available = isFolder || item.openStatus === 'AVAILABLE';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${isFolder ? 'folder' : available ? 'open document' : 'opening unavailable'}`}
        disabled={!available || selectedFile !== null}
        onPress={() => {
          if (isFolder) {
            if (folders.some((entry) => sameExternalId(entry.id, item.databaseId))) return;
            closeViewer();
            setNavigation({
              scope: rootScope,
              folders: [
                ...folders,
                {
                  id: item.databaseId,
                  name: item.name,
                  policyId: policyId || item.policyId || folder?.policyId || '',
                },
              ],
            });
          } else {
            setSelected({ scope: documents.scope, file: item });
          }
        }}
        style={({ pressed }) => [styles.itemCard, pressed ? styles.pressed : null]}>
        <View style={styles.itemTop}>
          <View style={styles.itemIconWrap}>
            <Ionicons
              name={isFolder ? 'folder-outline' : 'document-text-outline'}
              size={20}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>
              {item.source === 'PBIA' ? 'PBIA' : 'Historical document'}
            </Text>
            {item.createDate ? (
              <Text style={styles.itemMeta}>Created: {formatIsoDateTime(item.createDate)}</Text>
            ) : null}
            <Text style={styles.itemMeta}>
              {isFolder ? 'Open folder' : available ? 'Open document' : 'Opening unavailable'}
            </Text>
          </View>
          <Ionicons
            name={isFolder ? 'chevron-forward' : 'document-attach-outline'}
            size={18}
            color={theme.colors.textSubtle}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer scroll={false}>
      {selectedFile && userEmail ? (
        <DocumentViewer
          file={selectedFile}
          accountId={accountId}
          policyId={policyId || selectedFile.policyId || undefined}
          userEmail={userEmail}
          onClose={closeViewer}
          onAccessDenied={() => {
            closeViewer();
            documents.invalidate(
              'This document or policy is no longer available. Refresh to check access.'
            );
          }}
        />
      ) : null}
      <SectionHeader
        title="Documents"
        subtitle={
          folder
            ? `Folder: ${folder.name}`
            : policyNumber
              ? `Available documents for policy ${policyNumber}`
              : 'Available policy documents'
        }
      />
      {folder ? (
        <AppButton
          label={folders.length === 1 ? 'Back to documents' : 'Back to previous folder'}
          variant="ghost"
          onPress={() => {
            closeViewer();
            setNavigation({ scope: rootScope, folders: folders.slice(0, -1) });
          }}
        />
      ) : null}
      <AppButton
        label="Refresh"
        variant="secondary"
        onPress={refresh}
        loading={documents.loading === 'refresh'}
      />
      {documents.partial ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          Historical files are temporarily unavailable. Showing available saved documents. Refresh
          to try again.
        </Text>
      ) : null}
      {documents.loading === 'initial' || documents.loading === 'refresh' ? (
        <LoadingState
          title="Loading policy files"
          description="Retrieving available policy documents."
        />
      ) : documents.error ? (
        <EmptyState
          icon="warning-outline"
          title="Unable to load policy files"
          description={documents.error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : (
        <View style={styles.listCard}>
          <FlatList
            data={documents.files}
            keyExtractor={(item) => item.documentKey}
            renderItem={renderRow}
            onRefresh={refresh}
            refreshing={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              documents.partial ? null : (
                <EmptyState
                  icon="document-text-outline"
                  title="No documents available"
                  description="There are no documents available in this view."
                />
              )
            }
            ListFooterComponent={
              <View>
                {documents.moreError ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {documents.moreError}
                  </Text>
                ) : null}
                {documents.page < documents.totalPages ? (
                  <AppButton
                    label={documents.moreError ? 'Retry load more' : 'Load more'}
                    variant="secondary"
                    loading={documents.loading === 'more'}
                    onPress={documents.loadMore}
                  />
                ) : null}
              </View>
            }
          />
        </View>
      )}
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
