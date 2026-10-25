import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { colors } from '@/theme';

type OnboardingPage = {
  image: ImageSourcePropType;
  imageDescription: string;
  title: string;
  description: string;
};

const pages: OnboardingPage[] = [
  {
    image: require('../../../assets/images/onboarding/rehabilitacion-con-apoyo-y-cuidado.webp'),
    imageDescription: 'Profesional de salud acompaña a una persona durante su rehabilitación',
    title: 'Tu bienestar empieza aquí.',
    description: 'Equipo ortopédico y suministros para acompañarte cada día.',
  },
  {
    image: require('../../../assets/images/onboarding/asistencia-geriatrica-y-movilidad.webp'),
    imageDescription: 'Profesional de salud acompaña a una persona durante su movilidad',
    title: 'Muévete con confianza.',
    description: 'Encuentra apoyo para rehabilitación y movilidad en un solo lugar.',
  },
  {
    image: require('../../../assets/images/onboarding/tienda-de-ayudas-ortopedicas.webp'),
    imageDescription: 'Persona en rehabilitación usando apoyo para caminar',
    title: 'Cuidado a tu medida.',
    description: 'Conoce opciones de venta y renta de equipo médico.',
  },
];

type PaginationDotProps = {
  index: number;
  isSelected: boolean;
  onPress: () => void;
  scrollX: SharedValue<number>;
  width: number;
};

function PaginationDot({ index, isSelected, onPress, scrollX, width }: PaginationDotProps) {
  const animatedDotStyle = useAnimatedStyle(() => {
    const x = scrollX.get();
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const dotWidth = interpolate(x, inputRange, [8, 28, 8], Extrapolation.CLAMP);
    const opacity = interpolate(x, inputRange, [0.35, 1, 0.35], Extrapolation.CLAMP);

    return {
      opacity,
      width: dotWidth,
    };
  });

  return (
    <AppButton
      variant="unstyled"
      label={`Ir a pantalla ${index + 1} de ${pages.length}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      className="h-11 items-center justify-center px-1"
      hitSlop={{ bottom: 8, left: 4, right: 4, top: 8 }}
      onPress={onPress}
    >
      <Animated.View className="h-2 rounded-full bg-brand" style={animatedDotStyle} />
    </AppButton>
  );
}

type OnboardingSlideProps = {
  currentPage: number;
  height: number;
  index: number;
  page: OnboardingPage;
  reducedMotion: boolean;
  scrollX: SharedValue<number>;
  width: number;
};

function OnboardingSlide({
  currentPage,
  height,
  index,
  page,
  reducedMotion,
  scrollX,
  width,
}: OnboardingSlideProps) {
  const animatedSlideStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {};
    }
    const x = scrollX.get();
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const scale = interpolate(x, inputRange, [0.94, 1, 0.94], Extrapolation.CLAMP);
    const opacity = interpolate(x, inputRange, [0.45, 1, 0.45], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const isCurrent = currentPage === index;

  return (
    <ScrollView
      accessibilityElementsHidden={!isCurrent}
      contentContainerStyle={{ flexGrow: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      importantForAccessibility={isCurrent ? 'auto' : 'no-hide-descendants'}
      showsVerticalScrollIndicator={false}
      style={{ width }}
    >
      <Animated.View className="flex-1 justify-center px-6 py-4" style={animatedSlideStyle}>
        <View className="w-full items-center justify-center gap-4">
          <View className="items-center justify-center">
            <CatalogImage
              label={page.imageDescription}
              source={page.image}
              style={{
                height: Math.min(height * 0.42, 340),
                width: width * 0.88,
              }}
            />
          </View>

          <View className="w-full items-center gap-2.5 px-2">
            <Text className="w-full text-center font-sans-bold text-[26px] leading-[34px] text-primary">
              {page.title}
            </Text>
            <Text className="w-full text-center font-sans text-[17px] leading-[26px] text-secondary">
              {page.description}
            </Text>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<OnboardingPage>>(null);
  const { height, width } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });

  const goToPage = (page: number) => {
    flatListRef.current?.scrollToOffset({
      animated: !reducedMotion,
      offset: page * width,
    });
    setCurrentPage(page);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    const clampedPage = Math.max(0, Math.min(page, pages.length - 1));
    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage);
      void Haptics.selectionAsync().catch(() => undefined);
    }
  };

  const handleContinue = () => {
    if (currentPage === pages.length - 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      router.replace('/inicio');
      return;
    }

    goToPage(currentPage + 1);
  };

  const handleSkip = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.replace('/inicio');
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'right', 'bottom', 'left']}>
      {/* Barra superior con marca y botón Omitir */}
      <View className="min-h-14 flex-row items-center justify-between px-6 pb-2 pt-2">
        <CatalogImage
          label="Ortopedia CEMYDI"
          compact
          source={require('../../../assets/branding/cemydi-logo-horizontal.webp')}
          style={{ height: 36, width: 124 }}
        />
        {currentPage < pages.length - 1 ? (
          <AppButton
            variant="unstyled"
            label="Omitir introducción y explorar catálogo"
            accessibilityRole="button"
            className="min-h-11 min-w-[64px] items-center justify-center rounded-lg px-2 active:opacity-60"
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            onPress={handleSkip}
          >
            <Text className="font-sans-medium text-sm text-secondary" numberOfLines={1}>
              Omitir
            </Text>
          </AppButton>
        ) : (
          <View className="h-11 w-16" />
        )}
      </View>

      {/* Carrusel de diapositivas con animación nativa desacoplada */}
      <Animated.FlatList
        ref={flatListRef}
        bounces={false}
        data={pages}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          index,
          length: width,
          offset: width * index,
        })}
        horizontal
        keyExtractor={(item) => item.title}
        onMomentumScrollEnd={handleScrollEnd}
        onScroll={scrollHandler}
        pagingEnabled
        renderItem={({ index, item }) => (
          <OnboardingSlide
            currentPage={currentPage}
            height={height}
            index={index}
            page={item}
            reducedMotion={reducedMotion}
            scrollX={scrollX}
            width={width}
          />
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      />

      {/* Navegación y botón de acción anclados abajo */}
      <View className="gap-1 px-6 pb-6 pt-2">
        <View
          accessibilityLabel="Indicador de pantallas"
          accessibilityRole="tablist"
          className="flex-row items-center justify-center gap-1"
        >
          {pages.map((item, dotIndex) => (
            <PaginationDot
              key={item.title}
              index={dotIndex}
              isSelected={currentPage === dotIndex}
              onPress={() => goToPage(dotIndex)}
              scrollX={scrollX}
              width={width}
            />
          ))}
        </View>

        <AppButton
          accessibilityLabel={
            currentPage === pages.length - 1
              ? 'Explorar catálogo sin iniciar sesión'
              : 'Ir a la siguiente pantalla'
          }
          className="min-h-14 rounded-2xl"
          label={currentPage === pages.length - 1 ? 'Explorar catálogo' : 'Siguiente'}
          labelClassName="font-sans-semibold text-base"
          onPress={handleContinue}
          rightIcon={
            <ChevronRight aria-hidden color={colors.onBrand} size={16} strokeWidth={2.5} />
          }
        />
        <View className="min-h-11 items-center justify-center">
          <View
            pointerEvents={currentPage === pages.length - 1 ? 'auto' : 'none'}
            accessibilityElementsHidden={currentPage !== pages.length - 1}
            importantForAccessibility={
              currentPage === pages.length - 1 ? 'auto' : 'no-hide-descendants'
            }
            style={{ opacity: currentPage === pages.length - 1 ? 1 : 0 }}
            className="flex-row flex-wrap items-center justify-center gap-x-1"
          >
            <Text className="font-sans text-sm text-secondary">¿Ya tienes cuenta?</Text>
            <AppButton
              label="Inicia sesión"
              variant="ghost"
              className="px-1"
              labelClassName="text-sm text-brand-strong"
              onPress={() => router.replace('/login')}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
