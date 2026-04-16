import React from 'react';
import { Text } from 'react-native';

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};

export const mockUseLocalSearchParams = jest.fn(() => ({}));

export const router = mockRouter;

export function useLocalSearchParams() {
  return mockUseLocalSearchParams();
}

export function Redirect({ href }: { href: string }) {
  return <Text>{href}</Text>;
}

export const Stack = {
  Screen: () => null,
};

export const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;

Tabs.Screen = () => null;
