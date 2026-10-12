import { useCallback, useMemo, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/ui/BackButton';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Check from 'lucide-react-native/icons/check';
import Minus from 'lucide-react-native/icons/minus';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import TicketPercent from 'lucide-react-native/icons/ticket-percent';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import { useCatalogPreview, type PreviewCartItem } from '@/providers/catalog-preview-provider';
import { AppButton } from '@/components/ui/AppButton';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSheet } from '@/components/ui/AppSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors } from '@/theme';

import { useToast, useToastScroll } from '@/hooks/useToast';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { CartItemCard } from './components/CartItemCard';
import { RentalConfigurationSheet } from './components/RentalConfigurationSheet';
import {
  displayDraftDate,
  formatPreviewMoney,
  getCartEntries,
  getPreviewSummary,
  type CartPreviewEntry,
} from './cart-preview';

type CartSection = { mode: PreviewCartItem['mode']; title: string; data: CartPreviewEntry[] };
const cartKey = ({ item }: CartPreviewEntry) => `${item.productId}-${item.mode}`;
type Panel = 'review' | 'coupon' | null;
type CartSummaryProps = { sections: CartSection[]; onCoupon: () => void };
function CartSummary({ sections, onCoupon }: CartSummaryProps) {
  const purchase = sections.find((section) => section.mode === 'purchase');
  const rentals = sections.find((section) => section.mode === 'rental');
  const purchaseSummary = useMemo(() => getPreviewSummary(purchase?.data ?? []), [purchase]);
  const rentalSummary = useMemo(() => getPreviewSummary(rentals?.data ?? []), [rentals]);
  return (
    <View className="mx-5 gap-4 pb-4 pt-3">
      <AppButton
        label="Cupones · próximamente"
        variant="unstyled"
        className="flex-row items-center justify-between rounded-2xl bg-brand/5 px-3 py-2"
        onPress={onCoupon}
      >
        <View className="flex-1 flex-row items-center gap-3">
          <View className="rounded-full bg-brand/10 p-2">
            <TicketPercent aria-hidden color={colors.brandStrong} size={20} />
          </View>
          <Text className="flex-1 font-sans-semibold text-sm text-primary">¿Tienes un cupón?</Text>
        </View>
        <ChevronRight aria-hidden color={colors.brandStrong} size={18} />
      </AppButton>
      <View className="gap-2 border-t border-border/40 pt-3">
        <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
          Resumen
        </Text>
        {purchase ? (
          <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Text className="font-sans text-sm text-secondary">Subtotal de compra</Text>
            <Text
              accessibilityLabel={`Subtotal de compra: ${formatPreviewMoney(purchaseSummary.amount)}`}
              accessibilityLiveRegion="polite"
              className="font-sans-semibold text-base text-primary"
            >
              {formatPreviewMoney(purchaseSummary.amount)}
            </Text>
          </View>
        ) : null}
        {rentals ? (
          <>
            <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Text className="font-sans text-sm text-secondary">Renta por día</Text>
              <Text className="font-sans-semibold text-sm text-primary">
                {formatPreviewMoney(rentalSummary.amount)} / día
              </Text>
            </View>
            <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Text className="font-sans text-sm text-secondary">Depósitos de renta</Text>
              <Text className="font-sans-semibold text-sm text-primary">
                {formatPreviewMoney(rentalSummary.deposit)}
              </Text>
            </View>
            <Text className="font-sans text-xs leading-5 text-secondary">
              El total de renta se confirmará con las fechas y la disponibilidad.
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

export function CartPreviewScreen() {
  const router = useRouter();
  const toast = useToast();
  const onToastScroll = useToastScroll();
  const { requestAccess } = useAccountAccess();
  const { items, removeItem, restoreItem, selectMode } = useCatalogPreview();
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const entries = useMemo(() => getCartEntries(items), [items]);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const sections = useMemo(
    () =>
      [
        {
          mode: 'purchase',
          title: 'Compra',
          data: entries.filter(({ item }) => item.mode === 'purchase'),
        },
        {
          mode: 'rental',
          title: 'Renta',
          data: entries.filter(({ item }) => item.mode === 'rental'),
        },
      ].filter((section): section is CartSection => section.data.length > 0),
    [entries],
  );
  const configured = entries.find(
    ({ item }) => item.mode === 'rental' && item.productId === configuring,
  );
  const summary = useMemo(() => getPreviewSummary(entries), [entries]);
  const goToCatalog = useCallback(() => router.replace('/inicio'), [router]);
  const startSelection = useCallback(() => setSelectionMode(true), []);
  const openProduct = useThrottledCallback(
    (item: PreviewCartItem) =>
      router.push({
        pathname: '/producto/[id]',
        params: { id: item.productId, mode: item.mode },
      }),
    750,
  );
  const remove = useCallback(
    (item: PreviewCartItem, index: number) => {
      removeItem(item.productId, item.mode);
      toast.undoable({
        message: 'Producto eliminado',
        placement: 'bottom',
        duration: 6000,
        onUndo: async () => {
          restoreItem(item, index);
        },
        errorMessage: 'No se pudo restaurar el producto',
      });
    },
    [removeItem, restoreItem, toast],
  );
  const renderItem = useCallback(
    ({ item: entry }: { item: CartPreviewEntry }) => (
      <CartItemCard
        {...entry}
        index={items.indexOf(entry.item)}
        selectionMode={selectionMode}
        onStartSelection={startSelection}
        onConfigure={setConfiguring}
        onProduct={openProduct}
        onRemove={remove}
      />
    ),
    [items, selectionMode, startSelection, openProduct, remove],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: CartSection }) => (
      <CartSectionHeader section={section} selectionMode={selectionMode} onSelect={selectMode} />
    ),
    [selectionMode, selectMode],
  );
  const panelTitle = panel === 'coupon' ? 'Cupones' : 'Revisar carrito';
  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-3 px-5 py-2">
        <BackButton fallbackHref="/inicio" />
        <View className="flex-1 items-center gap-0.5">
          <Text accessibilityRole="header" className="font-sans-semibold text-xl text-primary">
            Mi carrito
          </Text>
        </View>
        <View className="w-11" />
      </View>
      {items.some((item) => item.productSnapshot) ? (
        <Text className="px-5 pb-2 font-sans text-xs leading-5 text-secondary">
          Carrito temporal de esta sesión. Importes estimados; disponibilidad y precios finales
          pendientes de confirmación.
        </Text>
      ) : null}
      {selectionMode && entries.length > 0 ? (
        <View className="mx-5 mb-1 flex-row items-center justify-between gap-3">
          <Text className="flex-1 font-sans-medium text-sm text-primary">
            Seleccionar productos
          </Text>
          <AppButton
            label="Listo"
            variant="ghost"
            labelClassName="text-sm text-brand-strong"
            onPress={() => setSelectionMode(false)}
          />
        </View>
      ) : null}
      {entries.length > 0 ? (
        <>
          <SectionList<CartPreviewEntry, CartSection>
            onScroll={onToastScroll}
            scrollEventThrottle={16}
            sections={sections}
            extraData={selectionMode}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 4 }}
            keyExtractor={cartKey}
            renderSectionHeader={renderSectionHeader}
            renderItem={renderItem}
            ListFooterComponent={
              <CartSummary sections={sections} onCoupon={() => setPanel('coupon')} />
            }
          />
          <View className="gap-2 border-t border-border/40 px-5 pb-2 pt-2">
            {summary.units !== count ? (
              <Text accessibilityLiveRegion="polite" className="font-sans text-xs text-secondary">
                {summary.units} de {count} unidades incluidas
              </Text>
            ) : null}
            <AppButton
              label="Revisar carrito"
              className="rounded-full"
              disabled={summary.units === 0}
              onPress={() => {
                if (requestAccess('/carrito')) setPanel('review');
              }}
              rightIcon={
                <ArrowRight
                  aria-hidden
                  color={summary.units === 0 ? colors.disabled : colors.onBrand}
                  size={20}
                />
              }
            />
          </View>
        </>
      ) : (
        <EmptyState
          title="Tu carrito está vacío"
          description="Encuentra lo que necesitas para compra o renta y añádelo aquí."
          actionLabel="Explorar catálogo"
          onAction={goToCatalog}
        />
      )}
      {configured ? (
        <RentalConfigurationSheet
          key={configured.item.productId}
          {...configured}
          onClose={() => setConfiguring(null)}
        />
      ) : null}
      <AppSheet title={panelTitle} visible={panel !== null} onClose={() => setPanel(null)}>
        {panel === 'coupon' ? (
          <Text className="font-sans text-base leading-7 text-secondary">
            Próximamente podrás aplicar un cupón desde tu cuenta. Por ahora no se aplica ningún
            descuento.
          </Text>
        ) : (
          <>
            {sections.map((section) => {
              const selected = section.data.filter(({ item }) => item.selected);
              if (selected.length === 0) return null;
              return (
                <View key={section.mode} className="gap-3">
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg text-primary"
                  >
                    {section.title}
                  </Text>
                  {selected.map(({ item, product }) => (
                    <View
                      key={`${item.productId}-${item.mode}`}
                      className="gap-1 border-b border-border/40 pb-2"
                    >
                      <Text className="font-sans-semibold text-sm text-primary">
                        {product.name} · {item.quantity}{' '}
                        {item.quantity === 1 ? 'unidad' : 'unidades'}
                      </Text>
                      {item.mode === 'rental' ? (
                        <Text className="font-sans text-sm leading-6 text-secondary">
                          {item.rentalDraft
                            ? `${displayDraftDate(item.rentalDraft.startDate)} al ${displayDraftDate(item.rentalDraft.endDate)} · Borrador`
                            : 'Falta elegir fechas'}
                          {product.prescription ? ' · Receta pendiente' : ''}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                  <Text className="font-sans text-sm leading-6 text-secondary">
                    {section.mode === 'rental'
                      ? 'Las fechas son borradores. La disponibilidad, la receta y el envío de la solicitud se habilitarán con tu cuenta. Esta revisión no envía una solicitud.'
                      : 'La compra y los pagos todavía no están habilitados.'}
                  </Text>
                </View>
              );
            })}
          </>
        )}
        <AppButton
          label="Volver al carrito"
          className="rounded-full"
          onPress={() => setPanel(null)}
        />
      </AppSheet>
    </AppScreen>
  );
}

type CartSectionHeaderProps = {
  section: CartSection;
  selectionMode: boolean;
  onSelect: (mode: PreviewCartItem['mode'], selected: boolean) => void;
};
function CartSectionHeader({ section, selectionMode, onSelect }: CartSectionHeaderProps) {
  const allSelected = section.data.every(({ item }) => item.selected);
  const anySelected = section.data.some(({ item }) => item.selected);
  const Icon = section.mode === 'rental' ? CalendarDays : ShoppingBag;
  return (
    <View className="min-h-11 flex-row flex-wrap items-center justify-between gap-2 px-5 pb-1 pt-1">
      <View className="flex-row items-center gap-2">
        <Icon aria-hidden color={colors.brandStrong} size={18} />
        <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
          {section.title}
        </Text>
      </View>
      {selectionMode ? (
        <AppButton
          label={`Seleccionar toda la sección ${section.title}`}
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: allSelected ? true : anySelected ? 'mixed' : false,
          }}
          variant="unstyled"
          className="min-h-11 flex-row items-center gap-2 px-1"
          onPress={() => onSelect(section.mode, !allSelected)}
        >
          <View
            className={`h-[18px] w-[18px] items-center justify-center rounded border ${anySelected ? 'border-brand-strong bg-brand-strong' : 'border-border bg-surface'}`}
          >
            {allSelected ? (
              <Check aria-hidden color={colors.onBrand} size={14} />
            ) : anySelected ? (
              <Minus aria-hidden color={colors.onBrand} size={14} />
            ) : null}
          </View>
          <Text className="font-sans text-xs text-secondary">Seleccionar todo</Text>
        </AppButton>
      ) : null}
    </View>
  );
}
