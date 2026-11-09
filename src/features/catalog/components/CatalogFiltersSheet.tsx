import { Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppSheet } from '@/components/ui/AppSheet';
import {
  catalogSortOptions,
  emptyProductFilters,
  type ProductFilters,
} from '@/services/products/product-service';
import { CatalogFilterChoice } from './CatalogFilterChoice';

type CatalogFiltersSheetProps = {
  applied: ProductFilters;
  options?: { clasificaciones: string[]; marcas: string[] };
  onChange: (filters: ProductFilters) => void;
  onClose: () => void;
};

export function CatalogFiltersSheet({
  applied,
  options,
  onChange,
  onClose,
}: CatalogFiltersSheetProps) {
  const availableOptions = options;
  const filters = applied;

  const toggle = (key: 'clasificaciones' | 'marcas', value: string) =>
    onChange({
      ...filters,
      [key]: filters[key].includes(value)
        ? filters[key].filter((item) => item !== value)
        : [...filters[key], value],
    });
  return (
    <AppSheet
      visible
      title="Filtrar catálogo"
      onClose={onClose}
      headerContent={
        <AppButton
          label="Aplicar filtros"
          onPress={onClose}
          accessibilityHint="Los cambios ya están aplicados. Cierra el panel para ver el catálogo."
        />
      }
    >
      <Text className="font-sans text-sm text-secondary">
        Los filtros se aplican al seleccionarlos.
      </Text>
      <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
        Ordenar por
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Ordenar por" className="gap-2">
        {catalogSortOptions.map((option) => (
          <CatalogFilterChoice
            single
            key={option.value}
            label={option.label}
            selected={filters.sort === option.value}
            onPress={() =>
              onChange({
                ...filters,
                sort: filters.sort === option.value ? 'reciente' : option.value,
              })
            }
            onClear={
              option.value !== 'reciente'
                ? () => onChange({ ...filters, sort: 'reciente' })
                : undefined
            }
          />
        ))}
      </View>
      <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
        Modalidad
      </Text>
      {(
        [
          ['VENTA', 'Compra'],
          ['RENTA', 'Renta'],
          ['MIXTO', 'Compra y renta'],
        ] as const
      ).map(([value, label]) => (
        <CatalogFilterChoice
          key={value}
          label={label}
          selected={filters.tipos.includes(value)}
          onClear={() =>
            onChange({ ...filters, tipos: filters.tipos.filter((item) => item !== value) })
          }
          onPress={() =>
            onChange({
              ...filters,
              tipos: filters.tipos.includes(value)
                ? filters.tipos.filter((item) => item !== value)
                : [...filters.tipos, value],
            })
          }
        />
      ))}
      {(['clasificaciones', 'marcas'] as const).map((key) => (
        <View key={key} className="gap-2">
          <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
            {key === 'marcas' ? 'Marcas' : 'Clasificaciones'}
          </Text>
          {!availableOptions ? (
            <Text className="font-sans text-sm text-secondary">
              Las opciones aparecerán al cargar el catálogo.
            </Text>
          ) : null}
          {availableOptions?.[key].map((value) => (
            <CatalogFilterChoice
              key={value}
              label={value}
              selected={filters[key].includes(value)}
              disabled={!filters[key].includes(value) && filters[key].length >= 20}
              onPress={() => toggle(key, value)}
              onClear={() => toggle(key, value)}
            />
          ))}
        </View>
      ))}
      <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
        Receta
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Receta" className="gap-2">
        {(
          [
            ['Todas', null],
            ['Con receta', true],
            ['Sin receta', false],
          ] as const
        ).map(([label, value]) => (
          <CatalogFilterChoice
            single
            key={label}
            label={label}
            selected={filters.requiereReceta === value}
            onPress={() =>
              onChange({
                ...filters,
                requiereReceta: filters.requiereReceta === value ? null : value,
              })
            }
            onClear={
              value !== null ? () => onChange({ ...filters, requiereReceta: null }) : undefined
            }
          />
        ))}
      </View>
      <CatalogFilterChoice
        label="Solo disponibles"
        onClear={() => onChange({ ...filters, soloDisponibles: false })}
        selected={filters.soloDisponibles}
        onPress={() => onChange({ ...filters, soloDisponibles: !filters.soloDisponibles })}
      />
      <AppButton
        label="Limpiar filtros"
        variant="ghost"
        onPress={() => onChange({ ...emptyProductFilters, search: applied.search })}
      />
    </AppSheet>
  );
}
