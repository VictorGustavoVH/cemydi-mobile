import { useState } from 'react';
import { Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import { AppButton } from '@/components/ui/AppButton';
import { AppSheet } from '@/components/ui/AppSheet';
import {
  catalogSortOptions,
  emptyProductFilters,
  type ProductFilters,
} from '@/services/products/product-service';
import { colors } from '@/theme';

type CatalogFiltersSheetProps = {
  applied: ProductFilters;
  options?: { clasificaciones: string[]; marcas: string[] };
  onChange: (filters: ProductFilters) => void;
  onClose: () => void;
};

function FilterChoice({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <AppButton
      label={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      variant={selected ? 'primary' : 'secondary'}
      className="justify-start"
      onPress={onPress}
      disabled={disabled}
      leftIcon={selected ? <Check aria-hidden color={colors.onBrand} size={18} /> : undefined}
    />
  );
}

export function CatalogFiltersSheet({
  applied,
  options,
  onChange,
  onClose,
}: CatalogFiltersSheetProps) {
  const [availableOptions, setAvailableOptions] = useState(options);
  if (options && options !== availableOptions) setAvailableOptions(options);
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
      {catalogSortOptions.map((option) => (
        <FilterChoice
          key={option.value}
          label={option.label}
          selected={filters.sort === option.value}
          onPress={() => onChange({ ...filters, sort: option.value })}
        />
      ))}
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
        <FilterChoice
          key={value}
          label={label}
          selected={filters.tipos.includes(value)}
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
            <FilterChoice
              key={value}
              label={value}
              selected={filters[key].includes(value)}
              disabled={!filters[key].includes(value) && filters[key].length >= 20}
              onPress={() => toggle(key, value)}
            />
          ))}
        </View>
      ))}
      <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
        Receta
      </Text>
      {(
        [
          ['Todas', null],
          ['Con receta', true],
          ['Sin receta', false],
        ] as const
      ).map(([label, value]) => (
        <FilterChoice
          key={label}
          label={label}
          selected={filters.requiereReceta === value}
          onPress={() => onChange({ ...filters, requiereReceta: value })}
        />
      ))}
      <FilterChoice
        label="Solo disponibles"
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
