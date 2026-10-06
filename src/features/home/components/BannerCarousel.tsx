import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import type { HomeBanner } from '../home-mocks';
import { useBannerPlayback } from '../hooks/useBannerPlayback';
import { CatalogImage } from './CatalogImage';

type BannerCarouselProps = { banners: HomeBanner[]; onExplore: () => void; suspended?: boolean };
export function BannerCarousel({ banners, onExplore, suspended = false }: BannerCarouselProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const currentIndex = useRef(0);
  const { fontScale } = useWindowDimensions();
  const advance = useCallback(() => {
    const next = (currentIndex.current + 1) % banners.length;
    currentIndex.current = next;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: width * next, animated: true });
  }, [banners.length, width]);
  const { reduceMotion, setPaused } = useBannerPlayback(
    advance,
    width > 0 && banners.length > 1 && !suspended,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: currentIndex.current * width, animated: false });
  }, [width]);

  function selectSlide(next: number) {
    setPaused(true);
    currentIndex.current = next;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: width * next, animated: !reduceMotion });
  }

  if (banners.length === 0) return null;

  return (
    <View className="mx-5" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View className="relative overflow-hidden rounded-2xl bg-brand/10">
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setPaused(true)}
          onScroll={(event) => {
            if (!width) return;
            const next = Math.max(
              0,
              Math.min(banners.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)),
            );
            currentIndex.current = next;
            setIndex(next);
          }}
          scrollEventThrottle={100}
        >
          {width > 0
            ? banners.map((banner, slideIndex) => (
                <View
                  key={banner.id}
                  accessibilityElementsHidden={slideIndex !== index}
                  importantForAccessibility={slideIndex === index ? 'auto' : 'no-hide-descendants'}
                  style={{ width }}
                  className={`min-h-[188px] gap-1 p-4 pb-9 ${fontScale > 1.3 ? 'flex-col' : 'flex-row items-center'}`}
                >
                  <View
                    className={`z-10 items-start gap-2 ${fontScale > 1.3 ? 'w-full' : 'flex-[1.2]'}`}
                  >
                    <Text
                      accessibilityRole="header"
                      className="font-sans-bold text-[20px] leading-[26px] tracking-tight text-primary"
                    >
                      {banner.title}
                    </Text>
                    <Text className="font-sans text-xs leading-5 text-secondary">
                      {banner.description}
                    </Text>
                    <AppButton
                      className="mt-1 px-3 py-2"
                      label="Explorar catálogo"
                      labelClassName="text-xs"
                      onPress={onExplore}
                    />
                  </View>
                  <View className={fontScale > 1.3 ? 'h-36 w-full' : 'h-36 flex-1'}>
                    <CatalogImage label={banner.title.replace('\n', ' ')} source={banner.image} />
                  </View>
                </View>
              ))
            : null}
        </ScrollView>

        <View
          pointerEvents="box-none"
          className="absolute bottom-2.5 left-0 right-0 flex-row items-center justify-center px-3"
        >
          <View className="flex-row items-center gap-1.5 px-2 py-1">
            {banners.map((banner, dotIndex) => (
              <AppButton
                key={banner.id}
                accessibilityState={{ selected: index === dotIndex }}
                className="h-4 w-4 px-0 py-0"
                hideLabel
                label={`Ver banner ${dotIndex + 1} de ${banners.length}`}
                onPress={() => selectSlide(dotIndex)}
                variant="unstyled"
              >
                <View
                  className={`h-1.5 rounded-full ${index === dotIndex ? 'w-5 bg-brand' : 'w-1.5 bg-border'}`}
                />
              </AppButton>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
