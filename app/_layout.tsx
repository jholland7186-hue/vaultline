import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/colors';
import { useVaultStore } from '@/store/vaultStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrateDemoIfEmpty = useVaultStore((s) => s.hydrateDemoIfEmpty);

  useEffect(() => {
    hydrateDemoIfEmpty();
    SplashScreen.hideAsync();
  }, [hydrateDemoIfEmpty]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.sand }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
