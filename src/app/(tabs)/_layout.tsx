import { Tabs } from 'expo-router';
import { GlobalBottomBar } from '@/components/ui/GlobalBottomBar';
import { colors } from '@/theme';

/**
 * Navegador de las cuatro pestañas principales. La barra visual es
 * GlobalBottomBar, montada como tabBar del navegador sin duplicar barras. Las pantallas quedan montadas al cambiar de
 * pestaña, así que conservan su scroll y no repiten sus animaciones de entrada.
 */
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="inicio"
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={() => <GlobalBottomBar />}
    >
      <Tabs.Screen name="inicio" />
      <Tabs.Screen name="catalogo" />
      <Tabs.Screen name="carrito" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}
