import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { AppButton } from '@/components/app-button';
import {
  PBIA_BASE_URL,
  PbiaFormRegistryItem,
  buildPbiaEmbeddedUrl,
  buildPbiaFormUrl,
  createPbiaInstanceId,
} from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';
import {
  appendPbiaWebViewDiagnostic,
  endPbiaWebViewSession,
  startPbiaWebViewSession,
  touchPbiaWebViewSessionHeartbeat,
} from '@/services/pbia-webview-diagnostics';

const INJECTED_BRIDGE_SCRIPT = `
  (function () {
    if (window.__pbiaBridgeReady) return;
    window.__pbiaBridgeReady = true;

    var forward = function (payload) {
      try {
        var message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        window.ReactNativeWebView.postMessage(message);
      } catch (error) {}
    };

    var originalPostMessage = window.postMessage;
    window.postMessage = function (data, targetOrigin, transfer) {
      forward(data);
      if (typeof originalPostMessage === 'function') {
        try {
          return originalPostMessage.call(window, data, targetOrigin, transfer);
        } catch (error) {}
      }
      return undefined;
    };

    window.addEventListener('message', function (event) {
      if (!event) return;
      forward(event.data);
    });
  })();
  true;
`;

type PbiaBridgePayload = {
  type?: unknown;
  event?: unknown;
  action?: unknown;
  height?: unknown;
  value?: unknown;
  url?: unknown;
  href?: unknown;
  path?: unknown;
  to?: unknown;
};

type PbiaFormWebViewProps = {
  form: PbiaFormRegistryItem;
  instanceId?: string;
  initialUrl?: string;
  autoHeight?: boolean;
  enableMessageBridge?: boolean;
};

function parseBridgePayload(raw: string): PbiaBridgePayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as PbiaBridgePayload;
  } catch {
    return null;
  }
}

function getMessageType(payload: PbiaBridgePayload) {
  const rawType = payload.type ?? payload.event ?? payload.action;
  return typeof rawType === 'string' ? rawType : null;
}

function getNavigationTarget(payload: PbiaBridgePayload) {
  const rawTarget = payload.url ?? payload.href ?? payload.path ?? payload.to;
  return typeof rawTarget === 'string' ? rawTarget : null;
}

function toHeightValue(payload: PbiaBridgePayload) {
  const rawHeight = payload.height ?? payload.value;
  const parsed = typeof rawHeight === 'number' ? rawHeight : Number(rawHeight);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(260, Math.min(parsed, 4000));
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isSameNavigationTarget(currentUrl: string, nextUrl: string) {
  try {
    const current = new URL(currentUrl);
    const next = new URL(nextUrl);
    return (
      current.origin === next.origin &&
      normalizePathname(current.pathname) === normalizePathname(next.pathname)
    );
  } catch {
    return false;
  }
}

function safeBuildEmbeddedUrl(target: string, instanceId: string) {
  try {
    const baseOrigin = new URL(PBIA_BASE_URL).origin;
    const resolvedTarget = new URL(target, PBIA_BASE_URL);
    if (resolvedTarget.origin !== baseOrigin) {
      return null;
    }
    return buildPbiaEmbeddedUrl(target, instanceId);
  } catch {
    return null;
  }
}

export function PbiaFormWebView({
  form,
  instanceId: providedInstanceId,
  initialUrl: providedInitialUrl,
  autoHeight = false,
  enableMessageBridge = false,
}: PbiaFormWebViewProps) {
  const shouldUseMessageBridge = autoHeight || enableMessageBridge;
  const instanceId = useMemo(() => providedInstanceId ?? createPbiaInstanceId(), [providedInstanceId]);
  const initialUrl = useMemo(
    () => providedInitialUrl ?? buildPbiaFormUrl(form, instanceId),
    [form, instanceId, providedInitialUrl]
  );
  const [webViewUrl, setWebViewUrl] = useState(initialUrl);
  const [webViewHeight, setWebViewHeight] = useState(900);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  const logDiagnostic = useCallback(
    (event: string, details?: unknown, level: 'info' | 'warn' | 'error' = 'info') => {
      void appendPbiaWebViewDiagnostic({
        event,
        details,
        level,
        formSlug: form.slug,
        sessionId: sessionIdRef.current ?? undefined,
      });
    },
    [form.slug]
  );

  useEffect(() => {
    let cancelled = false;

    const startSession = async () => {
      const session = await startPbiaWebViewSession(form.slug, initialUrl);
      if (cancelled) {
        await endPbiaWebViewSession(session.sessionId, 'session-cancelled-before-ready');
        return;
      }

      sessionIdRef.current = session.sessionId;
      logDiagnostic('embedded-webview-mounted', { initialUrl, messageBridge: shouldUseMessageBridge });
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
  }, [form.slug, initialUrl, logDiagnostic, shouldUseMessageBridge]);

  useEffect(() => {
    const heartbeat = setInterval(() => {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;
      void touchPbiaWebViewSessionHeartbeat(activeSessionId);
    }, 2000);

    return () => {
      clearInterval(heartbeat);
    };
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      logDiagnostic('embedded-app-state-change', { nextState });
    });
    const memoryWarningSubscription = AppState.addEventListener('memoryWarning', () => {
      logDiagnostic('embedded-memory-warning', undefined, 'warn');
    });

    return () => {
      appStateSubscription.remove();
      memoryWarningSubscription.remove();
    };
  }, [logDiagnostic]);

  const handleLoadStart = useCallback(
    (event: WebViewNavigationEvent) => {
      setLoading(true);
      setLoadError(null);
      logDiagnostic('webview-load-start', { url: event.nativeEvent.url });
    },
    [logDiagnostic]
  );

  const handleLoadEnd = useCallback(
    (event: WebViewNavigationEvent) => {
      setLoading(false);
      logDiagnostic('webview-load-end', {
        url: event.nativeEvent.url,
        canGoBack: event.nativeEvent.canGoBack,
        canGoForward: event.nativeEvent.canGoForward,
      });
    },
    [logDiagnostic]
  );

  const handleLoadError = useCallback(
    (event: WebViewErrorEvent) => {
      setLoading(false);
      setLoadError('The PBIA form could not be loaded right now.');
      logDiagnostic(
        'webview-load-error',
        {
          url: event.nativeEvent.url,
          domain: event.nativeEvent.domain,
          code: event.nativeEvent.code,
          description: event.nativeEvent.description,
        },
        'error'
      );
    },
    [logDiagnostic]
  );

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      setLoading(false);
      setLoadError('The PBIA form request failed. Please try again.');
      logDiagnostic(
        'webview-http-error',
        {
          url: event.nativeEvent.url,
          statusCode: event.nativeEvent.statusCode,
          description: event.nativeEvent.description,
        },
        'error'
      );
    },
    [logDiagnostic]
  );

  const handleContentProcessDidTerminate = useCallback(
    (event: WebViewTerminatedEvent) => {
      setLoading(false);
      setLoadError('The embedded form renderer terminated unexpectedly.');
      logDiagnostic('webview-content-process-terminated', event.nativeEvent, 'error');
    },
    [logDiagnostic]
  );

  const handleRenderProcessGone = useCallback(
    (event: WebViewRenderProcessGoneEvent) => {
      setLoading(false);
      setLoadError('The embedded form renderer terminated unexpectedly.');
      logDiagnostic('webview-render-process-gone', event.nativeEvent, 'error');
    },
    [logDiagnostic]
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = parseBridgePayload(event.nativeEvent.data);
      if (!payload) {
        logDiagnostic('bridge-message-parse-failed', event.nativeEvent.data, 'warn');
        return;
      }

      const messageType = getMessageType(payload);
      if (!messageType) return;

      if (messageType === 'scroll-parent') {
        return;
      }

      if (messageType === 'form-height') {
        const nextHeight = toHeightValue(payload);
        if (nextHeight && autoHeight) {
          setWebViewHeight(nextHeight);
        }
        return;
      }
  
      if (messageType === 'navigate' || messageType === 'navigate-to-policy') {
        const target = getNavigationTarget(payload);
        if (!target) return;
        const nextUrl = safeBuildEmbeddedUrl(target, instanceId);
        if (!nextUrl) {
          logDiagnostic('bridge-navigation-rejected', { target }, 'warn');
          return;
        }

        setWebViewUrl((currentUrl) => {
          if (isSameNavigationTarget(currentUrl, nextUrl)) {
            return currentUrl;
          }
          setLoadError(null);
          logDiagnostic('bridge-navigation-applied', { from: currentUrl, to: nextUrl });
          return nextUrl;
        });
      }
    } catch {
      // Ignore malformed bridge events so they cannot crash the app.
      logDiagnostic('bridge-message-handler-threw', undefined, 'error');
    }
  };

  const handleRetry = () => {
    setLoadError(null);
    setLoading(true);
    setWebViewUrl(initialUrl);
    setWebViewKey((prev) => prev + 1);
    logDiagnostic('embedded-webview-retry', { initialUrl });
  };

  return (
    <View style={[styles.container, !autoHeight ? styles.fill : null]}>
      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load form</Text>
          <Text style={styles.errorCopy}>{loadError}</Text>
          <AppButton label="Retry" variant="secondary" onPress={handleRetry} />
        </View>
      ) : (
        <View style={[styles.webViewWrap, autoHeight ? { height: webViewHeight } : styles.webViewFill]}>
          <WebView
            key={webViewKey}
            source={{ uri: webViewUrl }}
            injectedJavaScript={shouldUseMessageBridge ? INJECTED_BRIDGE_SCRIPT : undefined}
            javaScriptEnabled
            domStorageEnabled
            onMessage={shouldUseMessageBridge ? handleMessage : undefined}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleLoadError}
            onHttpError={handleHttpError}
            onContentProcessDidTerminate={handleContentProcessDidTerminate}
            onRenderProcessGone={handleRenderProcessGone}
            setSupportMultipleWindows={false}
            style={styles.webView}
          />

          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingLabel}>Loading form...</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 260,
  },
  fill: {
    flex: 1,
  },
  webViewWrap: {
    width: '100%',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  webViewFill: {
    flex: 1,
    minHeight: 420,
  },
  webView: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  loadingLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  errorCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  errorTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  errorCopy: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
});
