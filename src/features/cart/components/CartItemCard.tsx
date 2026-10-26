import { memo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import Trash from 'lucide-react-native/icons/trash';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { AppButton } from '@/components/ui/AppButton';
import { CatalogImage } from '@/components/ui/CatalogImage';
import {
  PREVIEW_CART_QUANTITY_LIMIT,
  type PreviewCartItem,
} from '@/providers/catalog-preview-provider';
import { useCartActions } from '@/providers/cart-provider';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { colors } from '@/theme';
import {
  displayDraftDate,
  formatPreviewMoney,
  previewAmount,
  type CartPreviewEntry,
} from '../cart-preview';

type CartItemCardProps = CartPreviewEntry & {
  selectionMode: boolean;
  onStartSelection: () => void;
  index: number;
  onRemove: (item: PreviewCartItem, index: number) => void;
  onConfigure: (productId: string) => void;
  onProduct: (item: PreviewCartItem) => void;
  disabled?: boolean;
};
export const CartItemCard = memo(function CartItemCard({
  item,
  index,
  product,
  selectionMode,
  onStartSelection,
  onRemove,
  onConfigure,
  onProduct,
  remote,
  disabled = false,
}: CartItemCardProps) {
  const { toggleSelection, updateQuantity } = useCartActions();
  const toast = useToast();
  const maxQuantity = remote?.availability.maxQuantity ?? PREVIEW_CART_QUANTITY_LIMIT;
  async function changeQuantity(quantity: number) {
    try {
      await updateQuantity(item.productId, item.mode, quantity, item.serverId);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    }
  }
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 390 || fontScale > 1.2 || selectionMode;
  const rental = item.mode === 'rental';
  const modeLabel = rental ? 'renta' : 'compra';
  const price = rental ? product.rental?.price : product.price;
  const priceLabel = (
    <Text className="font-sans-semibold text-sm text-primary">
      {formatPreviewMoney(previewAmount(price ?? '$0'))}
      {rental ? ' / día' : ''}
    </Text>
  );
  const quantityControl = (
    <View className="flex-row items-center rounded-full bg-surface">
      <AppButton
        hideLabel
        variant="ghost"
        className="h-11 w-11 rounded-full px-0 py-0"
        disabled={disabled || item.quantity <= 1}
        label={`Reducir cantidad de ${product.name}, ${modeLabel}`}
        onPress={() => void changeQuantity(item.quantity - 1)}
        leftIcon={
          <Minus
            aria-hidden
            color={item.quantity <= 1 ? colors.disabled : colors.textPrimary}
            size={16}
          />
        }
      />
      <Text
        accessibilityLabel={`Cantidad de ${product.name}, ${modeLabel}: ${item.quantity}`}
        className="min-w-5 text-center font-sans-semibold text-sm text-primary"
      >
        {item.quantity}
      </Text>
      <AppButton
        hideLabel
        variant="ghost"
        className="h-11 w-11 rounded-full px-0 py-0"
        disabled={disabled || item.quantity >= maxQuantity}
        label={`Aumentar cantidad de ${product.name}, ${modeLabel}`}
        onPress={() => void changeQuantity(item.quantity + 1)}
        leftIcon={
          <Plus
            aria-hidden
            color={
              item.quantity >= PREVIEW_CART_QUANTITY_LIMIT ? colors.disabled : colors.textPrimary
            }
            size={16}
          />
        }
      />
    </View>
  );
  function openProduct() {
    if (selectionMode) toggleSelection(item.productId, item.mode, item.serverId);
    else onProduct(item);
  }
  const selectionActions = [{ name: 'longpress', label: 'Seleccionar productos' }];
  const selectionHint = selectionMode
    ? 'Toca para cambiar la selección.'
    : 'Mantén presionado para seleccionar productos.';
  return (
    <View
      className={`mx-5 mb-2 gap-1 rounded-2xl border px-3 py-2 ${selectionMode && item.selected ? 'border-brand/30 bg-brand/5' : 'border-border/50 bg-surface'}`}
    >
      <View className="flex-row items-center gap-3">
        {selectionMode ? (
          <AppButton
            hideLabel
            variant="unstyled"
            className="h-11 w-11"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.selected }}
            label={`Seleccionar ${product.name}, ${modeLabel}`}
            onPress={() => toggleSelection(item.productId, item.mode, item.serverId)}
          >
            <View
              className={`h-[22px] w-[22px] items-center justify-center rounded-md border ${item.selected ? 'border-brand-strong bg-brand-strong' : 'border-border bg-surface'}`}
            >
              {item.selected ? <Check aria-hidden color={colors.onBrand} size={16} /> : null}
            </View>
          </AppButton>
        ) : null}
        <AppButton
          variant="unstyled"
          label={`Ver imagen de ${product.name}, ${modeLabel}`}
          accessibilityHint={selectionHint}
          accessibilityActions={selectionActions}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'longpress') onStartSelection();
          }}
          onLongPress={onStartSelection}
          onPress={openProduct}
          className="h-16 w-16 rounded-xl bg-surface-muted p-1.5"
        >
          <CatalogImage
            source={product.image}
            blurhash={product.imageBlurhash}
            label={product.name}
            compact
          />
        </AppButton>
        <View className="flex-1">
          <View className="flex-row items-start gap-1">
            <AppButton
              variant="unstyled"
              label={`Ver ${product.name}, ${modeLabel}`}
              accessibilityHint={selectionHint}
              accessibilityActions={selectionActions}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'longpress') onStartSelection();
              }}
              onLongPress={onStartSelection}
              onPress={openProduct}
              className="flex-1 justify-start py-1"
            >
              <View className="flex-1 gap-0.5">
                <Text className="font-sans-semibold text-sm leading-5 text-primary">
                  {product.name}
                </Text>
                <Text className="font-sans text-xs text-secondary">{product.category}</Text>
              </View>
            </AppButton>
            <AppButton
              hideLabel
              variant="ghost"
              className="h-11 w-11 px-0 py-0"
              label={`Eliminar ${product.name}, ${modeLabel}`}
              disabled={disabled}
              onPress={() => onRemove(item, index)}
              leftIcon={<Trash aria-hidden color={colors.textSecondary} size={17} />}
            />
          </View>
          {!compact ? (
            <View className="flex-row flex-wrap items-center justify-between gap-x-2">
              {priceLabel}
              {quantityControl}
            </View>
          ) : null}
        </View>
      </View>
      {compact ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          {priceLabel}
          {quantityControl}
        </View>
      ) : null}
      {remote?.availability.reason ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
          {remote.availability.reason}
        </Text>
      ) : null}
      {remote?.document ? (
        <Text className="font-sans text-sm text-secondary">
          Receta: {remote.document.originalFilename}. Si eliminas el producto, deshacer no recupera
          la receta.
        </Text>
      ) : null}
      {remote?.lineTotal != null ? (
        <Text className="font-sans text-sm text-primary">
          Subtotal de línea: {formatPreviewMoney(remote.lineTotal)}
        </Text>
      ) : null}
      {rental ? (
        <AppButton
          label={`${item.rentalDraft ? 'Editar' : 'Configurar'} renta de ${product.name}`}
          variant="unstyled"
          disabled={disabled}
          onPress={() => onConfigure(String(item.serverId ?? item.productId))}
          className="flex-row items-center justify-between gap-2 border-t border-border/30 pt-2"
        >
          <View className="flex-1 flex-row items-center gap-2">
            <CalendarDays aria-hidden color={colors.brandStrong} size={16} />
            <View className="flex-1">
              <Text className="font-sans-medium text-xs text-brand-strong">
                {item.rentalDraft
                  ? `${displayDraftDate(item.rentalDraft.startDate)} al ${displayDraftDate(item.rentalDraft.endDate)}${remote ? '' : ' · Borrador'}`
                  : 'Configurar renta'}
                {product.prescription ? ' · Requiere receta' : ''}
              </Text>
            </View>
          </View>
          <ChevronRight aria-hidden color={colors.brandStrong} size={16} />
        </AppButton>
      ) : null}
    </View>
  );
});
