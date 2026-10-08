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
  onApply: (filters: ProductFilters) => void;
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
  onApply,
  onClose,
}: CatalogFiltersSheetProps) {
  const [draft, setDraft] = useState(applied);
  const toggle = (key: 'clasificaciones' | 'marcas', value: string) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  return (
    <AppSheet visible title="Filtrar catálogo" onClose={onClose}>
      <Text className="font-sans text-sm text-secondary">
        Selecciona tus filtros y aplícalos para ver los resultados.
      </Text>
      <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
        Ordenar por
      </Text>
      {catalogSortOptions.map((option) => (
        <FilterChoice
          key={option.value}
          label={option.label}
          selected={draft.sort === option.value}
          onPress={() => setDraft({ ...draft, sort: option.value })}
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
          selected={draft.tipos.includes(value)}
          onPress={() =>
            setDraft({
              ...draft,
              tipos: draft.tipos.includes(value)
                ? draft.tipos.filter((item) => item !== value)
                : [...draft.tipos, value],
            })
          }
        />
      ))}
      {(['clasificaciones', 'marcas'] as const).map((key) => (
        <View key={key} className="gap-2">
          <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
            {key === 'marcas' ? 'Marcas' : 'Clasificaciones'}
          </Text>
          {!options ? (
            <Text className="font-sans text-sm text-secondary">
              Las opciones aparecerán al cargar el catálogo.
            </Text>
          ) : null}
          {options?.[key].map((value) => (
            <FilterChoice
              key={value}
              label={value}
              selected={draft[key].includes(value)}
              disabled={!draft[key].includes(value) && draft[key].length >= 20}
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
          selected={draft.requiereReceta === value}
          onPress={() => setDraft({ ...draft, requiereReceta: value })}
        />
      ))}
      <FilterChoice
        label="Solo disponibles"
        selected={draft.soloDisponibles}
        onPress={() => setDraft({ ...draft, soloDisponibles: !draft.soloDisponibles })}
      />
      <AppButton
        label="Limpiar filtros"
        variant="ghost"
        onPress={() => setDraft({ ...emptyProductFilters, search: applied.search })}
      />
      <AppButton label="Aplicar filtros" onPress={() => onApply(draft)} />
    </AppSheet>
  );
}
