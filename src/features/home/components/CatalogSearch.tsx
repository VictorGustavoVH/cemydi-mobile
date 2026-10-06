import { View } from 'react-native';
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { colors } from '@/theme';

type CatalogSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onFilters: () => void;
  onSubmit: () => void;
};
export function CatalogSearch({ value, onChange, onFilters, onSubmit }: CatalogSearchProps) {
  return (
    <View className="flex-row items-center gap-2 px-5 pb-4">
      <View className="flex-1">
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          className="border-border/50 bg-surface-muted text-sm"
          hideLabel
          label="Buscar equipo ortopédico"
          leadingIcon={<Search aria-hidden color={colors.textSecondary} size={19} />}
          maxLength={120}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          placeholder="Buscar equipo ortopédico"
          returnKeyType="search"
          value={value}
        />
      </View>
      <AppButton
        className="h-12 w-12 !border-border/50 px-0 py-0"
        hideLabel
        label="Filtrar catálogo"
        onPress={onFilters}
        variant="outline"
        leftIcon={<SlidersHorizontal aria-hidden color={colors.textPrimary} size={22} />}
      />
    </View>
  );
}
