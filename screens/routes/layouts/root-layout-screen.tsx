import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { theme } from '@/constants/theme';
import { AuthProvider } from '@/context/auth-context';
import { PoliciesProvider } from '@/context/policies-context';
import {
  appendPbiaWebViewDiagnostic,
  installPbiaGlobalErrorDiagnostics,
} from '@/services/pbia-webview-diagnostics';

export default function RootLayout() {
  useEffect(() => {
    installPbiaGlobalErrorDiagnostics();
    void appendPbiaWebViewDiagnostic({ event: 'app-root-mounted' });
  }, []);

  return (
    <AuthProvider>
      <PoliciesProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="policy/[id]"
            options={{
              headerShown: true,
              headerTitle: 'Policy Details',
              headerShadowVisible: false,
              headerTintColor: theme.colors.textStrong,
              headerStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="policy-files/index"
            options={{
              headerShown: true,
              headerTitle: 'Policy Files',
              headerShadowVisible: false,
              headerTintColor: theme.colors.textStrong,
              headerStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="company/index"
            options={{
              headerShown: true,
              headerTitle: 'Business Details',
              headerShadowVisible: false,
              headerTintColor: theme.colors.textStrong,
              headerStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="forms/index"
            options={{
              headerShown: true,
              headerTitle: 'Intake Forms',
              headerShadowVisible: false,
              headerTintColor: theme.colors.textStrong,
              headerStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="forms/[slug]"
            options={{
              headerShown: true,
              headerTitle: 'Form',
              headerShadowVisible: false,
              headerTintColor: theme.colors.textStrong,
              headerStyle: { backgroundColor: theme.colors.background },
            }}
          />
        </Stack>
      </PoliciesProvider>
    </AuthProvider>
  );
}
