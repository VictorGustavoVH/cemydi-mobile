import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, TextInput, View } from 'react-native';
import Clock from 'lucide-react-native/icons/clock';
import Search from 'lucide-react-native/icons/search';
import Mic from 'lucide-react-native/icons/mic';
import Square from 'lucide-react-native/icons/square';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import X from 'lucide-react-native/icons/x';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useQuery } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppScreenPopover } from '@/components/ui/AppScreenPopover';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { formatProductMoney } from '@/services/products/product-adapter';
import { emptyProductFilters, productService } from '@/services/products/product-service';
import { colors } from '@/theme';

type CatalogSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onFilters?: () => void;
  onSubmit: (term: string) => void;
  onSelectProduct?: (productId: string) => void;
  placeholder?: string;
  onOpenChange?: (open: boolean) => void;
  onSuggestionsInteractionChange?: (interacting: boolean) => void;
  dismissSignal?: number;
};

export function CatalogSearch({
  value,
  onChange,
  onClear,
  onFilters,
  onSubmit,
  onSelectProduct,
  placeholder = 'Buscar equipo ortopédico',
  onOpenChange,
  onSuggestionsInteractionChange,
  dismissSignal = 0,
}: CatalogSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const searchAnchor = useRef<View>(null);
  const lastDismissSignal = useRef(dismissSignal);
  const interacting = useRef(false);
  const gesture = useRef({ touch: false, drag: false, momentum: false });
  const { searches, addSearch, removeSearch } = useRecentSearches();
  const voice = useVoiceSearch(onChange);
  const { cancel: cancelVoice } = voice;
  const setInteracting = useCallback(
    (active: boolean) => {
      interacting.current = active;
      onSuggestionsInteractionChange?.(active);
    },
    [onSuggestionsInteractionChange],
  );
  const setGesture = useCallback(
    (phase: keyof typeof gesture.current, active: boolean) => {
      gesture.current[phase] = active;
      setInteracting(gesture.current.touch || gesture.current.drag || gesture.current.momentum);
    },
    [setInteracting],
  );
  const releaseGesture = useCallback(() => {
    gesture.current = { touch: false, drag: false, momentum: false };
    setInteracting(false);
  }, [setInteracting]);
  const debouncedQuery = useDebounce(value.trim(), 250);
  const suggestionsQuery = useQuery({
    queryKey: ['product-suggestions', debouncedQuery],
    queryFn: ({ signal }) =>
      productService.list({ ...emptyProductFilters, search: debouncedQuery }, 1, 10, signal),
    enabled: isFocused && debouncedQuery.length > 0,
    staleTime: 60_000,
  });
  const close = useCallback(() => {
    cancelVoice();
    releaseGesture();
    setIsFocused(false);
    Keyboard.dismiss();
  }, [cancelVoice, releaseGesture]);
  const submit = (term = value.trim()) => {
    if (term) addSearch(term);
    close();
    onSubmit(term);
  };
  const showOverlay = isFocused && (value.trim().length > 0 || searches.length > 0);
  useEffect(() => {
    if (lastDismissSignal.current === dismissSignal) return;
    lastDismissSignal.current = dismissSignal;
    close();
  }, [dismissSignal, close]);
  useEffect(() => {
    onOpenChange?.(showOverlay);
  }, [showOverlay, onOpenChange]);
  useEffect(() => () => onOpenChange?.(false), [onOpenChange]);
  useEffect(() => () => onSuggestionsInteractionChange?.(false), [onSuggestionsInteractionChange]);
  useEffect(() => {
    if (!showOverlay) releaseGesture();
  }, [showOverlay, releaseGesture]);
  useEffect(() => {
    const listener = Keyboard.addListener('keyboardDidHide', () => {
      if (!voice.listening && !voice.requesting) close();
    });
    return () => listener.remove();
  }, [close, voice.listening, voice.requesting]);

  const searchControls = (
    <View className="flex-row items-center gap-2">
      <View className="flex-1">
        <AppInput
          ref={inputRef}
          autoCapitalize="none"
          autoCorrect={false}
          className="border-border/50 bg-surface-muted text-sm"
          hideLabel
          label={placeholder}
          leadingIcon={<Search aria-hidden color={colors.textSecondary} size={19} />}
          maxLength={120}
          onChangeText={(text) => {
            voice.cancel();
            onChange(text);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            if (!interacting.current && !voice.listening && !voice.requesting) setIsFocused(false);
          }}
          onSubmitEditing={() => submit()}
          placeholder={placeholder}
          returnKeyType="search"
          trailingAction={
            voice.listening || voice.requesting || value.length === 0 ? (
              <AppButton
                className="h-11 w-11 !border-0 p-0"
                hideLabel
                label={voice.listening ? 'Detener dictado' : 'Buscar por voz'}
                loading={voice.requesting}
                accessibilityHint="Dicta el nombre del producto en español"
                leftIcon={
                  voice.listening ? (
                    <Square aria-hidden color={colors.brandStrong} size={18} />
                  ) : (
                    <Mic aria-hidden color={colors.textSecondary} size={20} />
                  )
                }
                onPress={() => {
                  if (voice.listening) voice.stop();
                  else void voice.start();
                }}
                variant="ghost"
              />
            ) : (
              <AppButton
                className="h-11 w-11 !border-0 p-0"
                hideLabel
                label="Borrar búsqueda"
                leftIcon={<X aria-hidden color={colors.textSecondary} size={18} />}
                onPress={() => {
                  voice.cancel();
                  onChange('');
                  onClear?.();
                  inputRef.current?.focus();
                }}
                variant="ghost"
              />
            )
          }
          value={value}
        />
      </View>
      {onFilters ? (
        <AppButton
          className="h-12 w-12 !border-border/50 px-0 py-0"
          hideLabel
          label="Filtrar catálogo"
          onPress={() => {
            close();
            onFilters();
          }}
          variant="outline"
          leftIcon={<SlidersHorizontal aria-hidden color={colors.textPrimary} size={22} />}
        />
      ) : null}
    </View>
  );
  const waiting = debouncedQuery !== value.trim() || suggestionsQuery.isLoading;
  return (
    <View className="relative z-50 px-5 pb-4" style={{ zIndex: 50, elevation: 10 }}>
      <View ref={searchAnchor} collapsable={false}>
        {searchControls}
      </View>
      {voice.listening ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-brand-strong">
          Escuchando… Di el nombre del producto.
        </Text>
      ) : voice.error ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
          {voice.error}
        </Text>
      ) : null}
      {showOverlay ? (
        <AppScreenPopover anchor={searchAnchor}>
          <View
            className="overflow-hidden rounded-2xl border border-border/80 bg-white p-3 shadow-xl"
            style={{ elevation: 12, flexShrink: 1 }}
            onTouchStart={() => setGesture('touch', true)}
            onTouchEnd={() => setGesture('touch', false)}
            onTouchCancel={() => setGesture('touch', false)}
          >
            <ScrollView
              accessibilityLabel="Sugerencias de búsqueda"
              bounces={false}
              keyboardDismissMode="none"
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled={false}
              overScrollMode="never"
              showsVerticalScrollIndicator
              style={{ maxHeight: 250, flexShrink: 1 }}
              onScrollBeginDrag={() => setGesture('drag', true)}
              onScrollEndDrag={() => setGesture('drag', false)}
              onMomentumScrollBegin={() => setGesture('momentum', true)}
              onMomentumScrollEnd={() => setGesture('momentum', false)}
            >
              {!value.trim() ? (
                <View className="gap-2">
                  <Text className="font-sans-medium text-xs uppercase tracking-wider text-secondary">
                    {searches.length ? 'Búsquedas recientes' : 'Escribe o dicta lo que buscas'}
                  </Text>
                  {searches.map((term) => (
                    <View key={term} className="flex-row items-center gap-2">
                      <AppButton
                        variant="unstyled"
                        label={`Buscar ${term}`}
                        className="min-h-11 flex-1 flex-row items-center gap-2 rounded-xl px-2"
                        onPress={() => {
                          onChange(term);
                          submit(term);
                        }}
                      >
                        <Clock aria-hidden color={colors.textSecondary} size={16} />
                        <Text numberOfLines={1} className="flex-1 font-sans text-sm text-primary">
                          {term}
                        </Text>
                      </AppButton>
                      <AppButton
                        variant="ghost"
                        className="h-11 w-11 p-0"
                        hideLabel
                        label={`Eliminar ${term} del historial`}
                        onPress={() => removeSearch(term)}
                        leftIcon={<X aria-hidden color={colors.textSecondary} size={15} />}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <View className="gap-2">
                  <Text className="font-sans-medium text-xs uppercase tracking-wider text-secondary">
                    Productos sugeridos
                  </Text>
                  {waiting ? (
                    <View accessibilityLabel="Cargando sugerencias" className="gap-3 py-2">
                      <SkeletonBlock className="h-10 w-full rounded-lg" />
                      <SkeletonBlock className="h-10 w-full rounded-lg" />
                    </View>
                  ) : suggestionsQuery.isError ? (
                    <ErrorState
                      description="No pudimos cargar las sugerencias. Puedes buscar en todo el catálogo."
                      onRetry={() => void suggestionsQuery.refetch()}
                    />
                  ) : suggestionsQuery.data?.products.length ? (
                    suggestionsQuery.data.products.map((product) => (
                      <AppButton
                        key={product.id}
                        variant="unstyled"
                        label={`${product.nombre}. ${formatProductMoney(product.precio)}`}
                        className="min-h-11 flex-row items-center gap-2.5 rounded-xl px-2 py-2"
                        onPress={() => {
                          addSearch(product.nombre);
                          close();
                          if (onSelectProduct) onSelectProduct(String(product.id));
                          else {
                            onChange(product.nombre);
                            onSubmit(product.nombre);
                          }
                        }}
                      >
                        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                          {product.imageUrl ? (
                            <CatalogImage
                              accessible={false}
                              compact
                              label={product.nombre}
                              source={{ uri: product.imageUrl }}
                              style={{ width: 40, height: 40 }}
                            />
                          ) : (
                            <Search aria-hidden color={colors.textSecondary} size={16} />
                          )}
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text
                            numberOfLines={1}
                            className="font-sans-semibold text-sm text-primary"
                          >
                            {product.nombre}
                          </Text>
                          <Text numberOfLines={1} className="font-sans text-xs text-secondary">
                            {product.clasificacion}
                          </Text>
                          <Text className="font-sans-semibold text-xs text-brand-strong">
                            {formatProductMoney(product.precio)}
                          </Text>
                        </View>
                        <ChevronRight aria-hidden color={colors.textSecondary} size={16} />
                      </AppButton>
                    ))
                  ) : (
                    <Text className="font-sans text-sm text-secondary">
                      No encontramos sugerencias para &quot;{value.trim()}&quot;
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
            {value.trim() ? (
              <AppButton
                variant="ghost"
                label={`Buscar "${value.trim()}" en todo el catálogo`}
                accessibilityLabel={`Buscar ${value.trim()} en el catálogo`}
                labelClassName="flex-shrink text-sm"
                leftIcon={<Search aria-hidden color={colors.brandStrong} size={16} />}
                onPress={() => submit()}
              />
            ) : null}
          </View>
        </AppScreenPopover>
      ) : null}
    </View>
  );
}
