import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type CSSProperties, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ScreenContainer } from '@/components/screen-container';
import { createPbiaInstanceId, findPbiaFormBySlug } from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';
import { usePolicies } from '@/context/policies-context';
import { usePbiaFormUrl } from '@/hooks/use-pbia-form-url';

export default function FormDetailWebScreen() {
  const { slug, policyId } = useLocalSearchParams<{ slug?: string; policyId?: string }>();
  const form = findPbiaFormBySlug(slug);
  const headerTitle = form?.title ?? 'Form';
  const { policies } = usePolicies();
  const { buildUrl } = usePbiaFormUrl();
  const policy = useMemo(
    () => policies.find((entry) => entry.id === policyId) ?? null,
    [policies, policyId]
  );
  const [formUrl] = useState(() => {
    if (!form) return '';
    return buildUrl(form, createPbiaInstanceId(), { policy });
  });

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
