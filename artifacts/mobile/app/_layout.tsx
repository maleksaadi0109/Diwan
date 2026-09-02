import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { setBaseUrl } from '@workspace/api-client-react';
import { LibraryProvider } from '@/contexts/LibraryContext';
import { PlaylistsProvider } from '@/contexts/PlaylistsContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import {
  Amiri_400Regular,
  Amiri_700Bold,
} from '@expo-google-fonts/amiri';
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import { useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// The mobile app reuses artifacts/api-server's existing YouTube import
// pipeline (download + align) as-is, reachable on the shared dev domain.
if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="poem" options={{ headerShown: false }} />
      <Stack.Screen name="playlist" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <SettingsProvider>
                <LibraryProvider>
                  <PlaylistsProvider>
                    <RootLayoutNav />
                  </PlaylistsProvider>
                </LibraryProvider>
              </SettingsProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
