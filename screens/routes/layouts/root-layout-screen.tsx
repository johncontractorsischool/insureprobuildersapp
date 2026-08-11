import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { PushNotificationRegistration } from '@/components/push-notification-registration';
import { theme } from '@/constants/theme';
import { AuthProvider } from '@/context/auth-context';
import { DigitalCardProvider } from '@/context/digital-card-context';
import { PaymentsProvider } from '@/context/payments-context';
import { PoliciesProvider } from '@/context/policies-context';
import {
  appendPbiaWebViewDiagnostic,
  installPbiaGlobalErrorDiagnostics,
} from '@/services/pbia-webview-diagnostics';
import { configureForegroundNotificationHandling } from '@/services/push-notifications';

export default function RootLayout() {
  useEffect(() => {
    installPbiaGlobalErrorDiagnostics();
    configureForegroundNotificationHandling();
    void appendPbiaWebViewDiagnostic({ event: 'app-root-mounted' });
  }, []);

  return (
    <AuthProvider>
      <PushNotificationRegistration />
      <PaymentsProvider>
        <DigitalCardProvider>
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
                name="digital-card/index"
                options={{
                  headerShown: true,
                  headerTitle: 'Digital Business Card',
                  headerShadowVisible: false,
                  headerTintColor: theme.colors.textStrong,
                  headerStyle: { backgroundColor: theme.colors.background },
                }}
              />
              <Stack.Screen name="card/[slug]" options={{ headerShown: false }} />
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
                name="payment/index"
                options={{
                  headerShown: true,
                  headerTitle: 'Make a Payment',
                  headerShadowVisible: false,
                  headerTintColor: theme.colors.textStrong,
                  headerStyle: { backgroundColor: theme.colors.background },
                }}
              />
              <Stack.Screen
                name="forms/index"
                options={{
                  headerShown: true,
                  headerTitle: 'Request A Quote',
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
        </DigitalCardProvider>
      </PaymentsProvider>
    </AuthProvider>
  );
}
