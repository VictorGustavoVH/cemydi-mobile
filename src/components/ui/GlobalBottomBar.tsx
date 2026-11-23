import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import { useCallback, useContext, useEffect } from 'react';
import { usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBottomBar } from '@/components/ui/AppBottomBar';
import { useCartCount } from '@/providers/cart-provider';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { ToastContext } from '@/hooks/useToast';

const MAIN_TABS = ['/inicio', '/catalogo', '/carrito', '/perfil'] as const;

/**
 * Barra de pestañas única para toda la app. Se monta una sola vez en el
 * layout de pestañas, visible solo en las pantallas principales. Comparte
 * el bloqueo de navegación con el resto de accesos de la aplicación.
 */
export function GlobalBottomBar() {
  const pathname = usePathname();
  const toastStore = useContext(ToastContext);
  const visible = MAIN_TABS.some((tab) => pathname === tab);
  useEffect(() => {
    if (!visible) toastStore?.setBottomBarHeight(0);
    return () => toastStore?.setBottomBarHeight(0);
  }, [toastStore, visible]);
  const router = useSafeNavigation();
  const cartCount = useCartCount();
  const { requestAccess } = useAccountAccess();
  const onHome = useCallback(() => {
    router.navigate({ pathname: '/inicio', params: { action: 'top', t: String(Date.now()) } });
  }, [router]);

  const onExplore = useCallback(() => {
    if (pathname !== '/catalogo') router.navigate('/catalogo');
  }, [pathname, router]);

  const onCart = useCallback(() => {
    if (pathname === '/carrito') return;
    router.navigate('/carrito');
  }, [pathname, router]);

  const onProfile = useCallback(() => {
    if (!requestAccess('/perfil')) return;
    router.navigate('/perfil');
  }, [requestAccess, router]);

  if (!visible) {
    return null;
  }

  return (
    <SafeAreaView
      edges={['bottom']}
      className="bg-background"
      onLayout={(event) => toastStore?.setBottomBarHeight(event.nativeEvent.layout.height)}
    >
      <AppBottomBar
        cartCount={cartCount}
        onCart={onCart}
        onExplore={onExplore}
        onHome={onHome}
        onProfile={onProfile}
        selectedTab={
          pathname === '/perfil'
            ? 'profile'
            : pathname === '/carrito'
              ? 'cart'
              : pathname === '/catalogo'
                ? 'explore'
                : 'home'
        }
      />
    </SafeAreaView>
  );
}
