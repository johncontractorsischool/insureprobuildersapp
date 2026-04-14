import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { PbiaFormWebView } from '@/components/pbia-form-webview';
import { ScreenContainer } from '@/components/screen-container';
import { buildPbiaFormUrl, createPbiaInstanceId, findPbiaFormBySlug } from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';
import {
  appendPbiaWebViewDiagnostic,
  clearPbiaWebViewDiagnostics,
  listPbiaWebViewDiagnostics,
  PbiaWebViewDiagnosticEntry,
  recoverPbiaWebViewSessionAfterRestart,
} from '@/services/pbia-webview-diagnostics';
import { openInAppBrowser } from '@/utils/external-actions';

const ENABLE_PBIA_EMBEDDED_FORMS = process.env.EXPO_PUBLIC_ENABLE_PBIA_EMBEDDED_FORMS === 'true';

function formatDiagnosticLine(entry: PbiaWebViewDiagnosticEntry) {
  const parsedDate = new Date(entry.timestamp);
  const hh = String(parsedDate.getHours()).padStart(2, '0');
  const mm = String(parsedDate.getMinutes()).padStart(2, '0');
  const ss = String(parsedDate.getSeconds()).padStart(2, '0');
  const details = entry.details ? ` | ${entry.details}` : '';
  return `${hh}:${mm}:${ss} ${entry.level.toUpperCase()} ${entry.event}${details}`;
}

export default function PbiaFormDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const form = findPbiaFormBySlug(slug);
  const headerTitle = form?.title ?? 'Form';
  const [showEmbeddedForm, setShowEmbeddedForm] = useState(false);
  const [diagnosticLines, setDiagnosticLines] = useState<PbiaWebViewDiagnosticEntry[]>([]);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const browserFormUrl = useMemo(
    () => (form ? buildPbiaFormUrl(form, createPbiaInstanceId()) : null),
    [form]
  );
  const canUseEmbeddedForm = Platform.OS !== 'web' && ENABLE_PBIA_EMBEDDED_FORMS;

  const refreshDiagnostics = useCallback(async () => {
    setIsLoadingDiagnostics(true);
    try {
      const lines = await listPbiaWebViewDiagnostics(5);
      setDiagnosticLines(lines);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    if (!canUseEmbeddedForm) {
      return;
    }

    let mounted = true;

    const initializeDiagnostics = async () => {
      const recoveredSession = await recoverPbiaWebViewSessionAfterRestart();
      await appendPbiaWebViewDiagnostic({
        event: 'form-detail-screen-opened',
        formSlug: form?.slug,
        details: { slug },
      });
      const lines = await listPbiaWebViewDiagnostics(5);
      if (!mounted) return;
      setDiagnosticLines(lines);

      if (recoveredSession) {
        Alert.alert(
          'Embedded Form Crash Detected',
          'A previous embedded session ended unexpectedly. Open "Refresh Crash Log" below to inspect the latest entries.'
        );
      }
    };

    void initializeDiagnostics();

    return () => {
      mounted = false;
    };
  }, [canUseEmbeddedForm, form?.slug, slug]);

  if (!form) {
    return (
      <>
        <Stack.Screen options={{ headerTitle }} />
        <ScreenContainer>
          <EmptyState
            icon="warning-outline"
            title="Form not found"
            description="The selected PBIA form could not be located."
            actionLabel="Back to forms"
            onAction={() => router.replace('/forms')}
          />
        </ScreenContainer>
      </>
    );
  }

  const handleOpenInBrowser = async () => {
    await appendPbiaWebViewDiagnostic({
      event: 'open-form-in-browser-pressed',
      formSlug: form.slug,
      details: { browserFormUrl },
    });
    const result = await openInAppBrowser(browserFormUrl, 'The form link is unavailable right now.');
    if (!result.ok) {
      Alert.alert('Unable to open form', result.message ?? 'Please try again.');
    }
  };

  const handleTryEmbeddedForm = () => {
    if (!canUseEmbeddedForm) {
      return;
    }

    void appendPbiaWebViewDiagnostic({
      event: 'try-embedded-form-pressed',
      formSlug: form.slug,
    });
    setShowEmbeddedForm(true);
  };

  const handleClearDiagnostics = async () => {
    await clearPbiaWebViewDiagnostics();
    await refreshDiagnostics();
  };

  const shouldUseBrowserFallback = Platform.OS !== 'web' && (!canUseEmbeddedForm || !showEmbeddedForm);

  return (
    <>
      <Stack.Screen options={{ headerTitle }} />
      <ScreenContainer
        scroll={shouldUseBrowserFallback}
        includeTopInset={false}
        style={styles.screen}>
        {shouldUseBrowserFallback ? (
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackTitle}>Open form in secure browser</Text>
            <Text style={styles.fallbackCopy}>
              To prevent app reloads while typing, this form opens in your device browser.
            </Text>
            <AppButton label="Open Form" onPress={() => void handleOpenInBrowser()} />
            {canUseEmbeddedForm ? (
              <>
                <AppButton
                  label="Try Embedded Form"
                  variant="secondary"
                  onPress={handleTryEmbeddedForm}
                />
                <Text style={styles.diagnosticsTitle}>Embedded Crash Log</Text>
                {diagnosticLines.length > 0 ? (
                  diagnosticLines.map((line) => (
                    <Text key={line.id} style={styles.diagnosticsLine}>
                      {formatDiagnosticLine(line)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.diagnosticsEmpty}>No diagnostic events recorded yet.</Text>
                )}
                <AppButton
                  label="Refresh Crash Log"
                  variant="secondary"
                  loading={isLoadingDiagnostics}
                  onPress={() => void refreshDiagnostics()}
                />
                <AppButton
                  label="Clear Crash Log"
                  variant="ghost"
                  onPress={() => void handleClearDiagnostics()}
                />
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            <PbiaFormWebView form={form} />
          </View>
        )}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: 0,
    gap: 0,
  },
  webViewContainer: {
    flex: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadows.surface,
  },
  fallbackCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  fallbackTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  fallbackCopy: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  diagnosticsTitle: {
    ...theme.typography.label,
    color: theme.colors.textStrong,
    marginTop: theme.spacing.xs,
  },
  diagnosticsLine: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontFamily: 'Courier',
  },
  diagnosticsEmpty: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
});
