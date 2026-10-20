import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Image } from 'expo-image';
import { StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';
import type { DocumentContentProps } from '@/utils/document-preview';

function NativePreviewUnavailable() {
  return (
    <Text style={styles.notice}>
      PDF preview requires the updated mobile app build. It is not available in Expo Go.
    </Text>
  );
}

type NativePreviewModule = typeof import('./native-document-content');

function loadNativePreview(): NativePreviewModule['NativeDocumentContent'] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo Go cannot load these native modules at startup.
    const module = require('./native-document-content') as NativePreviewModule;
    return module.NativeDocumentContent;
  } catch {
    return NativePreviewUnavailable;
  }
}

export function DocumentContent(props: DocumentContentProps) {
  if (props.kind === 'image') {
    return (
      <Image
        source={{ uri: props.url }}
        accessibilityLabel={props.title}
        style={styles.fill}
        contentFit="contain"
        cachePolicy="none"
        onError={props.onError}
      />
    );
  }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return <NativePreviewUnavailable />;
  }
  // Load only after the Expo Go check; older development builds can still use other screens.
  const NativeDocumentContent = loadNativePreview();
  return <NativeDocumentContent {...props} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
  notice: { ...theme.typography.body, padding: theme.spacing.lg, color: theme.colors.textMuted },
});
