import { useCallback, useContext, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBottomBar } from '@/components/ui/AppBottomBar';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { ToastContext } from '@/hooks/useToast';

const NAV_LOCK_MS = 600;
const MAIN_TABS = ['/inicio', '/catalogo', '/carrito'] as const;

/**
 * Barra de pestañas única para toda la app. Se monta una sola vez en el
 * layout raíz, visible solo en las pantallas principales. Bloquea toques
 * repetidos durante NAV_LOCK_MS para que un doble tap no dispare dos
 * navegaciones y apile pantallas.
 */
export function GlobalBottomBar() {
  const pathname = usePathname();
  const toastStore = useContext(ToastContext);
  const visible = MAIN_TABS.some((tab) => pathname === tab || pathname?.startsWith(`${tab}/`));
  useEffect(() => {
    if (!visible) toastStore?.setBottomBarHeight(0);
    return () => toastStore?.setBottomBarHeight(0);
  }, [toastStore, visible]);
  const router = useRouter();
  const { items } = useCatalogPreview();
  const { requestAccess } = useAccountAccess();
  const lastNavAt = useRef(0);

  const locked = useCallback(() => {
    const now = Date.now();
    if (now - lastNavAt.current < NAV_LOCK_MS) return true;
    lastNavAt.current = now;
    return false;
  }, []);

  const onHome = useCallback(() => {
    if (locked()) return;
    router.replace({ pathname: '/inicio', params: { action: 'top', t: String(Date.now()) } });
  }, [locked, router]);

  const onExplore = useCallback(() => {
    if (locked()) return;
    if (pathname !== '/catalogo') router.push('/catalogo');
  }, [locked, pathname, router]);

  const onCart = useCallback(() => {
    if (locked() || pathname === '/carrito') return;
    router.push('/carrito');
  }, [locked, pathname, router]);

  const onProfile = useCallback(() => {
    if (locked() || !requestAccess('/perfil')) return;
    router.push('/perfil');
  }, [locked, requestAccess, router]);

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
        cartCount={items.reduce((sum, item) => sum + item.quantity, 0)}
        onCart={onCart}
        onExplore={onExplore}
        onHome={onHome}
        onProfile={onProfile}
        selectedTab={
          pathname === '/carrito' ? 'cart' : pathname === '/catalogo' ? 'explore' : 'home'
        }
      />
    </SafeAreaView>
  );
}
