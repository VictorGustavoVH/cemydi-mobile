import { ScrollView, View } from 'react-native';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { AppButton } from '@/components/ui/AppButton';
import { emptyProductFilters, type ProductFilters } from '@/services/products/product-service';
import { colors } from '@/theme';

type CatalogQuickFiltersProps = {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  onOpenFilters: () => void;
};

export function CatalogQuickFilters({
  filters,
  onChange,
  onOpenFilters,
}: CatalogQuickFiltersProps) {
  const count =
    filters.clasificaciones.length +
    filters.marcas.length +
    filters.tipos.length +
    Number(filters.requiereReceta !== null) +
    Number(filters.soloDisponibles) +
    Number(filters.sort !== 'reciente');
  const purchase =
    filters.tipos.length === 2 &&
    filters.tipos.includes('VENTA') &&
    filters.tipos.includes('MIXTO');
  const rental =
    filters.tipos.length === 2 &&
    filters.tipos.includes('RENTA') &&
    filters.tipos.includes('MIXTO');
  const choices = [
    {
      label: 'Todos',
      selected: filters.tipos.length === 0,
      next: { ...emptyProductFilters, search: filters.search },
    },
    {
      label: 'Compra',
      selected: purchase,
      next: { ...filters, tipos: ['VENTA', 'MIXTO'] },
    },
    {
      label: 'Renta',
      selected: rental,
      next: { ...filters, tipos: ['RENTA', 'MIXTO'] },
    },
    {
      label: 'Disponibles',
      selected: filters.soloDisponibles,
      next: { ...filters, soloDisponibles: !filters.soloDisponibles },
    },
    {
      label: 'Menor precio',
      selected: filters.sort === 'precio-asc',
      next: { ...filters, sort: filters.sort === 'precio-asc' ? 'reciente' : 'precio-asc' },
    },
  ] satisfies { label: string; selected: boolean; next: ProductFilters }[];
  return (
    <View className="flex-row items-center gap-2 pb-4 pl-5">
      <AppButton
        accessibilityLabel="Filtrar catálogo"
        accessibilityHint="Abre todas las opciones de filtros"
        label={`Filtros${count ? ` (${count})` : ''}`}
        variant={count ? 'primary' : 'outline'}
        className="min-h-11 shrink-0 rounded-full px-3 py-2"
        labelClassName="text-sm"
        onPress={onOpenFilters}
        leftIcon={
          <SlidersHorizontal
            aria-hidden
            color={count ? colors.onBrand : colors.brandStrong}
            size={18}
          />
        }
      />
      <ScrollView
        horizontal
        style={{ flex: 1 }}
        accessibilityLabel="Filtros rápidos; desliza para ver más"
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 20 }}
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Modalidad"
          className="flex-row gap-2"
        >
          {choices.slice(0, 3).map((choice) => (
            <AppButton
              key={choice.label}
              label={choice.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: choice.selected }}
              variant={choice.selected ? 'primary' : 'outline'}
              className="min-h-11 rounded-full px-4 py-2"
              labelClassName="text-sm"
              onPress={() => onChange(choice.next)}
            />
          ))}
        </View>
        {choices.slice(3).map((choice) => (
          <AppButton
            key={choice.label}
            label={choice.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: choice.selected }}
            variant={choice.selected ? 'primary' : 'outline'}
            className="min-h-11 rounded-full px-4 py-2"
            labelClassName="text-sm"
            onPress={() => onChange(choice.next)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
