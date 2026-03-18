import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { theme } from '@/constants/theme';
import { AuthProvider } from '@/context/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack>
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
      </Stack>
    </AuthProvider>
  );
}
