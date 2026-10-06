import { View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { catalogModes, type CatalogMode } from '../home-mocks';

type CatalogModeFilterProps = { value: CatalogMode; onChange: (mode: CatalogMode) => void };
export function CatalogModeFilter({ value, onChange }: CatalogModeFilterProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {catalogModes.map((mode) => (
        <AppButton
          key={mode.value}
          accessibilityState={{ selected: value === mode.value }}
          className={`min-w-[80px] rounded-full px-5 py-2 ${value === mode.value ? '' : '!border-border/70'}`}
          label={mode.label}
          labelClassName={`text-sm ${value === mode.value ? '' : 'text-secondary'}`}
          onPress={() => onChange(mode.value)}
          variant={value === mode.value ? 'primary' : 'outline'}
        />
      ))}
    </View>
  );
}
