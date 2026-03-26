import { Redirect, Stack } from 'expo-router';

import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/context/auth-context';

export default function AuthLayout() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState title="Restoring session" description="Checking your secure login state..." />
      </ScreenContainer>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
