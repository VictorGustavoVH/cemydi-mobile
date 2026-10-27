import '../../global.css';

import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QueryProvider } from '@/providers/query-provider';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { CartProvider } from '@/providers/cart-provider';
import { NotificationLifecycle } from '@/features/notifications/NotificationLifecycle';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme';

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
          <SafeAreaProvider>
            <ToastProvider>
              <AuthProvider>
                <CartProvider>
                  <NotificationLifecycle />
                  <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <Stack
                      screenOptions={{
                        // Cada pantalla monta su propio encabezado; el Stack no debe añadir otro.
                        headerShown: false,
                        // Avoid Android native transitions leaving screen content partially transparent.
                        animation: Platform.OS === 'android' ? 'none' : 'default',
                        contentStyle: { backgroundColor: colors.background },
                      }}
                    >
                      <Stack.Screen name="index" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="(tabs)"
                        options={{ headerShown: false, animation: 'none' }}
                      />
                      <Stack.Screen name="login" options={{ headerShown: false }} />
                      <Stack.Screen name="register" options={{ headerShown: false }} />
                      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
                      <Stack.Screen name="otp" options={{ headerShown: false }} />
                      <Stack.Screen name="new-password" options={{ headerShown: false }} />
                    </Stack>
                  </View>
                </CartProvider>
              </AuthProvider>
            </ToastProvider>
          </SafeAreaProvider>
        </CatalogPreviewProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
