import '../../global.css';

import { useEffect } from 'react';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QueryProvider } from '@/providers/query-provider';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* Ignorar errores de carrera en recarga */
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {
        /* Ignorar errores si ya fue ocultado */
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryProvider>
        <StatusBar style="dark" />
        {Platform.OS === 'android' ? (
          <RNStatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
        ) : null}
        <CatalogPreviewProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="inicio" options={{ headerShown: false }} />
          </Stack>
        </CatalogPreviewProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
