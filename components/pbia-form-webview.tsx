import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { PbiaFormRegistryItem, buildPbiaFormUrl, createPbiaInstanceId } from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';
import {
  appendPbiaWebViewDiagnostic,
  endPbiaWebViewSession,
  startPbiaWebViewSession,
} from '@/services/pbia-webview-diagnostics';
import { openInAppBrowser } from '@/utils/external-actions';

type PbiaFormWebViewProps = {
  form: PbiaFormRegistryItem;
  instanceId?: string;
  autoHeight?: boolean;
  enableMessageBridge?: boolean;
};

export function PbiaFormWebView({
  form,
  instanceId: providedInstanceId,
  autoHeight = false,
  enableMessageBridge = false,
}: PbiaFormWebViewProps) {
  const instanceId = useMemo(() => providedInstanceId ?? createPbiaInstanceId(), [providedInstanceId]);
  const formUrl = useMemo(() => buildPbiaFormUrl(form, instanceId), [form, instanceId]);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startSession = async () => {
      const session = await startPbiaWebViewSession(form.slug, formUrl);
      if (cancelled) {
        await endPbiaWebViewSession(session.sessionId, 'session-cancelled-before-ready');
        return;
      }

      sessionIdRef.current = session.sessionId;
      await appendPbiaWebViewDiagnostic({
        event: 'embedded-webview-stub-mounted',
        formSlug: form.slug,
        sessionId: session.sessionId,
        details: {
          formUrl,
          autoHeight,
          enableMessageBridge,
        },
      });
    };

    void startSession();

    return () => {
      cancelled = true;
      const activeSessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (activeSessionId) {
        void endPbiaWebViewSession(activeSessionId, 'component-unmount');
      }
    };
  }, [autoHeight, enableMessageBridge, form.slug, formUrl]);

  const handleOpenInBrowser = async () => {
    await appendPbiaWebViewDiagnostic({
      event: 'embedded-webview-stub-open-browser-pressed',
      formSlug: form.slug,
      sessionId: sessionIdRef.current ?? undefined,
      details: { formUrl },
    });

    await openInAppBrowser(formUrl, 'The form link is unavailable right now.');
  };

  return (
    <View style={[styles.container, autoHeight ? styles.autoHeight : styles.fill]}>
      <View style={styles.card}>
        <Text style={styles.title}>Embedded form unavailable in this build</Text>
        <Text style={styles.copy}>
          The original PBIA WebView integration depends on native packages that are not installed in
          this repo. This stub keeps the route safe and opens the form externally instead.
        </Text>
        <Text style={styles.metaLabel}>Selected form</Text>
        <Text style={styles.metaValue}>{form.title}</Text>
        <Text style={styles.metaLabel}>Resolved URL</Text>
        <Text style={styles.url}>{formUrl}</Text>
        <AppButton
          label="Open Form in Browser"
          variant="secondary"
          onPress={() => void handleOpenInBrowser()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 260,
  },
  autoHeight: {
    minHeight: 260,
  },
  fill: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    justifyContent: 'center',
    ...theme.shadows.surface,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  copy: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  metaLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: theme.spacing.xs,
  },
  metaValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  url: {
    ...theme.typography.mono,
    color: theme.colors.textMuted,
  },
});
