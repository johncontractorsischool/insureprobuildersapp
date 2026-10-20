import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';

import { theme } from '@/constants/theme';
import type { DocumentContentProps } from '@/utils/document-preview';
import { downloadDocumentPreview } from '@/utils/native-document-file';

export function NativeDocumentContent({ url, onError }: DocumentContentProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [pages, setPages] = useState({ current: 1, total: 0 });
  const source = useMemo(() => ({ uri: localUri ?? '', cache: false }), [localUri]);
  useEffect(() => {
    let active = true;
    setLocalUri(null);
    const download = downloadDocumentPreview(url);
    void download.ready
      .then((uri) => {
        if (active && uri) setLocalUri(uri);
      })
      .catch(() => {
        if (active) onError();
      });
    return () => {
      active = false;
      download.dispose();
    };
  }, [onError, url]);
  if (!localUri)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  return (
    <View style={styles.container}>
      {pages.total > 0 ? (
        <Text style={styles.pages}>
          Page {pages.current} of {pages.total}
        </Text>
      ) : null}
      <Pdf
        source={source}
        style={styles.pdf}
        trustAllCerts={false}
        fitPolicy={0}
        enableDoubleTapZoom
        onError={() => onError()}
        onLoadComplete={(total) => setPages({ current: 1, total })}
        onPageChanged={(current, total) => setPages({ current, total })}
        onPressLink={() => {
          /* Keep document navigation inside this viewer. */
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pdf: { flex: 1, width: '100%', backgroundColor: theme.colors.surfaceTint },
  pages: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    padding: theme.spacing.xs,
  },
});
