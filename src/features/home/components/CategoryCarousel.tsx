import { ScrollView, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import type { HomeCategory } from '@/data/catalog-preview';
import { CatalogImage } from '@/components/ui/CatalogImage';
import Tags from 'lucide-react-native/icons/tags';
import { colors } from '@/theme';

type CategoryCarouselProps = {
  categories: HomeCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};
export function CategoryCarousel({ categories, selectedId, onSelect }: CategoryCarouselProps) {
  return (
    <View className="mt-4 gap-3">
      <View className="px-5">
        <Text
          accessibilityRole="header"
          className="font-sans-semibold text-lg tracking-tight text-primary"
        >
          Categorías
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        className="grow-0"
        accessibilityLabel="Categorías de equipo; desliza para ver más"
      >
        {categories.map((category) => {
          const selected = selectedId === category.id;
          return (
            <AppButton
              key={category.id}
              accessibilityState={{ selected }}
              className="w-[100px]"
              label={category.label}
              onPress={() => onSelect(category.id)}
              variant="unstyled"
            >
              <View className="w-full items-center gap-2">
                <View
                  className={`h-[76px] w-full rounded-2xl border p-2 ${selected ? 'border-brand bg-brand/15' : 'border-transparent bg-brand/5'}`}
                >
                  {category.image ? (
                    <CatalogImage compact label={category.label} source={category.image} />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Tags
                        aria-hidden
                        color={selected ? colors.brandStrong : colors.textSecondary}
                        size={28}
                      />
                    </View>
                  )}
                </View>
                <Text
                  className={`text-center text-xs ${selected ? 'font-sans-semibold text-brand-strong' : 'font-sans-medium text-secondary'}`}
                >
                  {category.label}
                </Text>
              </View>
            </AppButton>
          );
        })}
      </ScrollView>
    </View>
  );
}
