import { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBottomBar } from '@/components/ui/AppBottomBar';
import { AppSheet } from '@/components/ui/AppSheet';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { useAccountAccess } from '@/hooks/useAccountAccess';

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
  const router = useRouter();
  const { items } = useCatalogPreview();
  const { user, requestAccess } = useAccountAccess();
  const [profileOpen, setProfileOpen] = useState(false);
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
    const destination = pathname === '/carrito' ? '/carrito' : '/inicio';
    if (!requestAccess(destination)) return;
    setProfileOpen(true);
  }, [pathname, requestAccess]);

  if (!MAIN_TABS.some((tab) => pathname === tab || pathname?.startsWith(`${tab}/`))) {
    return null;
  }

  return (
    <SafeAreaView edges={['bottom']} className="bg-background">
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
      <AppSheet onClose={() => setProfileOpen(false)} title="Tu perfil" visible={profileOpen}>
        <Text className="font-sans text-base leading-6 text-secondary">
          {user?.nombre}
          {'\n'}
          {user?.correo}
        </Text>
      </AppSheet>
    </SafeAreaView>
  );
}
