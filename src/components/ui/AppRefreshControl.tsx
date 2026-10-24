import type { ReactNode } from 'react';
import { RefreshControl, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

type AppRefreshControlProps = {
  refreshing: boolean;
  onRefresh: () => void;
  /** Android: bloquea el gesto cuando no hay una recarga disponible. */
  enabled?: boolean;
  /**
   * Android: `ScrollView` clona este elemento para envolver el contenido del
   * scroll, inyectando `style` y los hijos. Reenviarlos es obligatorio o la
   * pantalla queda vacía.
   */
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * `RefreshControl` con los tokens de marca del sistema de diseño. Se usa con
 * `usePullToRefresh` para que el indicador solo responda a recargas del usuario.
 */
export function AppRefreshControl({
  refreshing,
  onRefresh,
  enabled = true,
  style,
  children,
}: AppRefreshControlProps) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      style={style}
      tintColor={colors.brandStrong}
      colors={[colors.brandStrong]}
      progressBackgroundColor={colors.surface}
    >
      {children}
    </RefreshControl>
  );
}
