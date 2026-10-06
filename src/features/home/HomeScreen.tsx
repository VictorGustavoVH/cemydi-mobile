import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, RefreshControl, Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { AppScreen } from '@/components/ui/AppScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { BannerCarousel } from './components/BannerCarousel';
import { CatalogModeFilter } from './components/CatalogModeFilter';
import { CatalogSearch } from './components/CatalogSearch';
import { CategoryCarousel } from './components/CategoryCarousel';
import { HomeBottomBar } from './components/HomeBottomBar';
import { HomeHeader } from './components/HomeHeader';
import { HomePreviewSheet } from './components/HomePreviewSheet';
import { ProductCard } from './components/ProductCard';
import type { CatalogMode, HomeProduct } from './home-mocks';
import { useHome } from './hooks/useHome';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';

type Preview = { kind: 'filters' } | { kind: 'info'; title: string; description: string };
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

type ProductItemProps = {
  product: HomeProduct;
  mode: CatalogMode;
  onOpen: (productId: string, mode: CatalogMode | undefined) => void;
};

const ProductItem = memo(function ProductItem({ product, mode, onOpen }: ProductItemProps) {
  const handlePress = useCallback(() => {
    onOpen(product.id, mode === 'all' ? product.modes[0] : mode);
  }, [onOpen, product.id, product.modes, mode]);
  return <ProductCard product={product} onPress={handlePress} />;
});

export function HomeScreen() {
  const router = useRouter();
  const { items } = useCatalogPreview();
  const scrollRef = useRef<FlatList<HomeProduct>>(null);
  const productOffset = useRef(0);
  const reducedMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<CatalogMode>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const { data, loading, error, refetch } = useHome();
  const homeProducts = useMemo(() => data?.products ?? [], [data]);
  const homeBanners = useMemo(() => data?.banners ?? [], [data]);
  const homeCategories = useMemo(() => data?.categories ?? [], [data]);
  const normalizedSearch = useMemo(() => normalize(search), [search]);
  const products = useMemo(
    () =>
      homeProducts.filter(
        (product) =>
          (!category || product.categoryId === category) &&
          (mode === 'all' || product.modes.includes(mode)) &&
          normalize(product.name).includes(normalizedSearch),
      ),
    [homeProducts, category, mode, normalizedSearch],
  );
  const oneColumn = width < 350 || fontScale > 1.3;
  const columns = oneColumn ? 1 : 2;

  const openProduct = useCallback(
    (productId: string, productMode: CatalogMode | undefined) => {
      router.push({
        pathname: '/producto/[id]',
        params: { id: productId, mode: productMode },
      });
    },
    [router],
  );

  function resetFilters() {
    setSearch('');
    setMode('all');
    setCategory(null);
  }
  function explore() {
    Keyboard.dismiss();
    scrollRef.current?.scrollToOffset({ offset: productOffset.current, animated: !reducedMotion });
  }
  function showProfile() {
    setPreview({
      kind: 'info',
      title: 'Tu perfil',
      description:
        'Aquí podrás administrar tu cuenta. Por ahora estás explorando una vista de muestra.',
    });
  }
  const sheetTitle = preview?.kind === 'filters' ? 'Filtrar catálogo' : (preview?.title ?? '');

  if (loading && !data) {
    return (
      <AppScreen edges={['top', 'left', 'right', 'bottom']}>
        <LoadingState label="Cargando catálogo…" />
      </AppScreen>
    );
  }

  if (error && !data) {
    return (
      <AppScreen edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState description={error.message} onRetry={refetch} />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        ref={scrollRef}
        key={oneColumn ? 'one' : 'two'}
        data={products}
        renderItem={({ item }) => (
          <View className={columns > 1 ? 'flex-1' : 'flex-1 px-5'}>
            <ProductItem product={item} mode={mode} onOpen={openProduct} />
          </View>
        )}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12, paddingHorizontal: 20 } : undefined}
        ItemSeparatorComponent={() => <View className="h-4" />}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading && data !== null} onRefresh={refetch} />
        }
        ListHeaderComponent={
          <>
            <HomeHeader
              onNotifications={() =>
                setPreview({
                  kind: 'info',
                  title: 'Notificaciones',
                  description: 'No tienes notificaciones en esta vista de muestra.',
                })
              }
              onProfile={showProfile}
            />
            <CatalogSearch
              onChange={setSearch}
              onFilters={() => {
                Keyboard.dismiss();
                setPreview({ kind: 'filters' });
              }}
              onSubmit={explore}
              value={search}
            />
            <BannerCarousel
              banners={homeBanners}
              onExplore={() => {
                resetFilters();
                explore();
              }}
              suspended={preview !== null || search.length > 0}
            />
            <CategoryCarousel
              categories={homeCategories}
              onSelect={(id) => setCategory(category === id ? null : id)}
              selectedId={category}
            />
            <View
              className="gap-4 px-5 pt-4"
              onLayout={(event) => {
                productOffset.current = event.nativeEvent.layout.y;
              }}
            >
              <View className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="font-sans-semibold text-lg tracking-tight text-primary"
                >
                  Filtros
                </Text>
                <CatalogModeFilter onChange={setMode} value={mode} />
              </View>
              <View className="flex-row items-center justify-between gap-2">
                <Text
                  accessibilityRole="header"
                  className="flex-1 font-sans-semibold text-lg tracking-tight text-primary"
                >
                  Para tu bienestar
                </Text>
                <AppButton
                  className="px-1 py-2"
                  label="Ver todo"
                  labelClassName="text-xs text-brand-strong"
                  onPress={resetFilters}
                  variant="ghost"
                />
              </View>
              {category || search || mode !== 'all' ? (
                <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
                  {products.length} {products.length === 1 ? 'producto' : 'productos'} de muestra
                  {category
                    ? ` · ${homeCategories.find((item) => item.id === category)?.label}`
                    : ''}
                </Text>
              ) : null}
            </View>
            <View className="h-4" />
          </>
        }
        ListEmptyComponent={
          <View className="px-5">
            <View className="items-center gap-3 rounded-2xl bg-surface-muted px-5 py-8">
              <Text className="text-center font-sans-semibold text-lg text-primary">
                No encontramos productos
              </Text>
              <Text className="text-center font-sans text-sm text-secondary">
                Prueba otra búsqueda o cambia los filtros.
              </Text>
              <AppButton label="Limpiar filtros" onPress={resetFilters} variant="outline" />
            </View>
          </View>
        }
        ListFooterComponent={
          <Text className="px-5 pt-6 text-center font-sans text-xs text-secondary">
            Vista de muestra · imágenes y precios ilustrativos
          </Text>
        }
      />
      <HomeBottomBar
        cartCount={items.reduce((sum, item) => sum + item.quantity, 0)}
        onCart={() => router.push('/carrito')}
        onExplore={explore}
        onHome={() => scrollRef.current?.scrollToOffset({ offset: 0, animated: !reducedMotion })}
        onProfile={showProfile}
      />
      <HomePreviewSheet
        onClose={() => setPreview(null)}
        title={sheetTitle}
        visible={preview !== null}
      >
        {preview?.kind === 'filters' ? (
          <>
            <Text className="font-sans text-sm text-secondary">¿Qué estás buscando?</Text>
            <CatalogModeFilter onChange={setMode} value={mode} />
            <AppButton label="Limpiar filtros" onPress={resetFilters} variant="ghost" />
            <AppButton
              label={`Ver ${products.length} productos`}
              onPress={() => {
                setPreview(null);
                explore();
              }}
            />
          </>
        ) : preview?.kind === 'info' ? (
          <Text className="font-sans text-base leading-6 text-secondary">
            {preview.description}
          </Text>
        ) : null}
      </HomePreviewSheet>
    </AppScreen>
  );
}
