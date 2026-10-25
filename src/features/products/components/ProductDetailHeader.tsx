import { useRef, useState } from 'react';
import { Share, View } from 'react-native';
import type { Href } from 'expo-router';
import Heart from 'lucide-react-native/icons/heart';
import ShareIcon from 'lucide-react-native/icons/share';

import { AppButton } from '@/components/ui/AppButton';
import { BackButton } from '@/components/ui/BackButton';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/providers/auth-provider';
import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { colors } from '@/theme';

type ProductDetailHeaderProps = {
  productId: string;
  fallbackHref: Href;
  /** Nombre del producto; sin él, compartir permanece deshabilitado. */
  productName?: string;
  productCaption?: string;
};

/**
 * Barra superior del detalle (volver, favorito y compartir).
 * Se reutiliza durante la carga para que los iconos aparezcan de inmediato,
 * en la misma posición, evitando el salto al montar la ficha completa.
 */
export function ProductDetailHeader({
  productId,
  fallbackHref,
  productName,
  productCaption,
}: ProductDetailHeaderProps) {
  const { user } = useAuth();
  const preview = useCatalogPreview();
  const backendFavorites = useFavorites();
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  const sharingLock = useRef(false);

  const isBackend = Boolean(user && /^\d+$/.test(productId));
  const favorite = isBackend
    ? backendFavorites.isFavorite(productId)
    : preview.favorites.includes(productId);

  async function shareProduct() {
    if (!productName || sharingLock.current) return;
    sharingLock.current = true;
    setSharing(true);
    try {
      await Share.share({
        title: productName,
        message: productCaption
          ? `${productName} · CEMYDI\nDisponible para ${productCaption.toLowerCase()}.`
          : `${productName} · CEMYDI`,
      });
    } catch {
      toast.error('No se pudo compartir. Inténtalo de nuevo.');
    } finally {
      sharingLock.current = false;
      setSharing(false);
    }
  }

  return (
    <View className="flex-row items-center gap-3 bg-white px-5 py-2">
      <BackButton fallbackHref={fallbackHref} />

      <View className="flex-1 flex-row items-center justify-end gap-1">
        <AppButton
          hideLabel
          label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          accessibilityState={{ selected: favorite }}
          disabled={isBackend && backendFavorites.isPendingToggle}
          variant="ghost"
          className="h-11 w-11 rounded-full px-0 py-0"
          onPress={() => {
            if (isBackend) {
              backendFavorites.toggleFavorite(productId);
            } else {
              preview.toggleFavorite(productId);
              toast.info(
                favorite ? 'Eliminado de favoritos.' : 'Guardado en favoritos durante esta sesión.',
              );
            }
          }}
          leftIcon={
            <Heart
              aria-hidden
              color={favorite ? colors.favorite : colors.textPrimary}
              fill={favorite ? colors.favorite : 'none'}
              size={24}
            />
          }
        />

        <AppButton
          hideLabel
          label="Compartir producto"
          variant="ghost"
          loading={sharing}
          disabled={!productName}
          className="h-11 w-11 rounded-full px-0 py-0"
          onPress={() => void shareProduct()}
          leftIcon={
            sharing ? undefined : <ShareIcon aria-hidden color={colors.textPrimary} size={22} />
          }
        />
      </View>
    </View>
  );
}
