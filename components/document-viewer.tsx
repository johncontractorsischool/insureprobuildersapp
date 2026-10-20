import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { DocumentContent } from '@/components/document-content';
import { theme } from '@/constants/theme';
import { isDocumentAccessDenied } from '@/hooks/use-policy-documents';
import { fetchClientDocumentViewUrl } from '@/services/policy-files-api';
import type { PolicyFileEntry } from '@/types/policy-file';
import { documentKind } from '@/utils/document-preview';
import { prepareDocumentBrowser, type DocumentBrowser } from '@/utils/document-browser';

type Props = {
  file: PolicyFileEntry;
  accountId: string;
  policyId?: string;
  userEmail: string;
  onClose: () => void;
  onAccessDenied: () => void;
};

export function DocumentViewer({
  file,
  accountId,
  policyId,
  userEmail,
  onClose,
  onAccessDenied,
}: Props) {
  const kind = documentKind(file);
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openingExternal, setOpeningExternal] = useState(false);
  const [externalFailed, setExternalFailed] = useState(false);
  const externalRequest = useRef<DocumentBrowser | null>(null);
  const denied = useRef(onAccessDenied);
  denied.current = onAccessDenied;

  useEffect(() => {
    setOpeningExternal(false);
    setExternalFailed(false);
    return () => {
      externalRequest.current?.close();
      externalRequest.current = null;
    };
  }, [accountId, file.documentKey, policyId, userEmail]);

  const openExternal = async () => {
    if (externalRequest.current) return;
    let browser: DocumentBrowser;
    setExternalFailed(false);
    try {
      browser = prepareDocumentBrowser();
    } catch {
      setExternalFailed(true);
      return;
    }
    externalRequest.current = browser;
    setOpeningExternal(true);
    try {
      const link = await fetchClientDocumentViewUrl(userEmail, {
        documentKey: file.documentKey,
        accountId,
        policyId,
      });
      if (externalRequest.current !== browser) return;
      await browser.open(link.url);
    } catch (error: unknown) {
      browser.close();
      if (externalRequest.current !== browser) return;
      if (isDocumentAccessDenied(error)) denied.current();
      else setExternalFailed(true);
    } finally {
      if (externalRequest.current === browser) {
        externalRequest.current = null;
        setOpeningExternal(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    setLoading(true);
    if (!kind) {
      setLoading(false);
      return;
    }
    void fetchClientDocumentViewUrl(userEmail, {
      documentKey: file.documentKey,
      accountId,
      policyId,
    })
      .then((link) => {
        if (active) {
          setUrl(link.url);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoading(false);
        if (isDocumentAccessDenied(error)) denied.current();
        else setFailed(true);
      });
    // The link lives only in this mounted viewer and never in route params or persistent storage.
    return () => {
      active = false;
    };
  }, [accountId, attempt, file.documentKey, kind, policyId, userEmail]);

  const previewFailed = useCallback(() => {
    setUrl(null);
    setFailed(true);
  }, []);
  const retry = () => {
    setUrl(null);
    setAttempt((value) => value + 1);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {file.name}
          </Text>
          <View style={styles.actions}>
            {kind ? (
              <AppButton
                label={failed ? 'Retry' : 'Reload'}
                accessibilityLabel={failed ? 'Retry preview' : 'Reload document'}
                size="compact"
                variant="secondary"
                disabled={loading}
                onPress={retry}
              />
            ) : null}
            <AppButton
              label={Platform.OS === 'web' ? 'New tab' : 'Browser'}
              accessibilityLabel={Platform.OS === 'web' ? 'Open in new tab' : 'Open in browser'}
              size="compact"
              variant="secondary"
              loading={openingExternal}
              onPress={openExternal}
            />
            <AppButton
              label="Close"
              accessibilityLabel="Close document"
              size="compact"
              variant="secondary"
              onPress={onClose}
            />
          </View>
        </View>
        {externalFailed ? (
          <Text accessibilityRole="alert" style={styles.externalError}>
            {Platform.OS === 'web'
              ? 'Unable to open the document externally. Allow pop-ups in your browser and try again.'
              : 'Unable to open the document in your browser. Please try again.'}
          </Text>
        ) : null}
        <View style={styles.content}>
          {!kind ? (
            <Text style={styles.message}>
              Preview is available for PDF, PNG, and JPEG documents.
            </Text>
          ) : loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.message}>Opening document…</Text>
            </View>
          ) : failed ? (
            <View style={styles.loading}>
              <Text accessibilityRole="alert" style={styles.message}>
                Unable to display this document. Retry to request a fresh link.
              </Text>
            </View>
          ) : url ? (
            <DocumentContent
              key={`${file.documentKey}-${attempt}`}
              url={url}
              kind={kind}
              title={file.name}
              onError={previewFailed}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    ...theme.typography.bodySmall,
    fontWeight: '700',
    color: theme.colors.textStrong,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: '100%',
  },
  externalError: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  content: { flex: 1, minHeight: 0 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    padding: theme.spacing.md,
    textAlign: 'center',
  },
});
