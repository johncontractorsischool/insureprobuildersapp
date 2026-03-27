import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type CSSProperties, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ScreenContainer } from '@/components/screen-container';
import { PBIA_BASE_URL, findPbiaFormBySlug } from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';

export default function FormDetailWebScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const form = findPbiaFormBySlug(slug);
  const headerTitle = form?.title ?? 'Form';
  const formUrl = useMemo(() => {
    if (!form) return '';
    return new URL(form.path, PBIA_BASE_URL).toString();
  }, [form]);

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

  return (
    <>
      <Stack.Screen options={{ headerTitle }} />
      <ScreenContainer includeTopInset={false} scroll={false} style={styles.screen}>
        <View style={styles.webViewContainer}>
          <iframe title={headerTitle} src={formUrl} style={iframeStyle} />
        </View>
      </ScreenContainer>
    </>
  );
}

const iframeStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  backgroundColor: '#FFFFFF',
};

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
});
