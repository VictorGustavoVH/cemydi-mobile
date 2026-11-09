import { Keyboard, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Star from 'lucide-react-native/icons/star';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppSheet } from '@/components/ui/AppSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { AccountAccessBoundary } from '@/components/account/AccountAccessBoundary';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { useUnsavedAccountChanges } from '@/components/account/UnsavedAccountChanges';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { colors } from '@/theme';
import { reviewFormSchema, type ReviewFormValues } from './review-service';
import { useWriteReview } from './useWriteReview';

type ReviewFormProps = {
  resource: ReturnType<typeof useWriteReview>;
  close: () => void;
  visible: boolean;
};
function ReviewForm({ resource, close, visible }: ReviewFormProps) {
  const review = resource.query.data?.review;
  const toast = useToast();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    mode: 'onTouched',
    defaultValues: { rating: review?.rating ?? 0, comment: review?.comment ?? '' },
  });
  const disabled = resource.saving || resource.isOnline === false;
  const changes = useUnsavedAccountChanges({ dirty: isDirty, saving: resource.saving });
  const submit = handleSubmit(async (values) => {
    try {
      const result = await resource.save(values);
      reset({ rating: result.review.rating, comment: result.review.comment });
      Keyboard.dismiss();
      toast.success('Tu reseña se envió y está en revisión.');
    } catch (error) {
      setError('root.server', { message: getFriendlyErrorMessage(error) });
    }
  });
  return (
    <AppSheet
      title={
        changes.confirming ? '¿Salir sin guardar?' : review ? 'Editar reseña' : 'Escribir reseña'
      }
      visible={visible}
      onClose={changes.confirming ? changes.cancel : close}
      closeDisabled={resource.saving}
    >
      {changes.confirming ? (
        <>
          <Text className="font-sans text-base leading-6 text-secondary">
            Tienes cambios pendientes. Si sales, se descartarán.
          </Text>
          <AppButton label="Seguir editando" onPress={changes.cancel} />
          <AppButton label="Descartar cambios" variant="ghost" onPress={changes.discard} />
        </>
      ) : (
        <>
          <Text accessibilityRole="header" className="font-sans-semibold text-lg text-primary">
            {resource.productQuery.data?.product.nombre}
          </Text>
          {review ? (
            <AccountStatusBadge kind="review" status={review.status} appearance="inline" />
          ) : null}
          <Text className="font-sans text-sm leading-6 text-secondary">
            Comparte tu experiencia con este producto. Revisaremos tu opinión antes de publicarla.
          </Text>
          {resource.isOnline === false ? (
            <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
              Sin conexión. Tu comentario se conserva aquí; conéctate para enviarlo.
            </Text>
          ) : null}
          <Controller
            control={control}
            name="rating"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <Text className="font-sans-semibold text-base text-primary">Tu calificación</Text>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Tu calificación"
                  className="flex-row flex-wrap gap-2"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <AppButton
                      key={value}
                      label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                      hideLabel
                      variant="unstyled"
                      accessibilityRole="radio"
                      accessibilityState={{ checked: field.value === value }}
                      disabled={disabled}
                      className="h-11 w-11 items-center justify-center"
                      onPress={() => {
                        field.onChange(value);
                        field.onBlur();
                      }}
                    >
                      <Star
                        aria-hidden
                        size={28}
                        color={value <= field.value ? colors.rating : colors.disabled}
                        fill={value <= field.value ? colors.rating : 'none'}
                      />
                    </AppButton>
                  ))}
                </View>
                {fieldState.error ? (
                  <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
                    {fieldState.error.message}
                  </Text>
                ) : null}
              </View>
            )}
          />
          <Controller
            control={control}
            name="comment"
            render={({ field, fieldState }) => (
              <AppInput
                ref={field.ref}
                label="Tu opinión"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                editable={!disabled}
                multiline
                maxLength={500}
                autoCapitalize="sentences"
                helperText={`${field.value.length}/500 caracteres · mínimo 5`}
                placeholder="¿Cómo fue tu experiencia con este producto?"
              />
            )}
          />
          {errors.root?.server?.message ? (
            <Text
              accessibilityLiveRegion="polite"
              className="font-sans text-sm leading-6 text-danger"
            >
              {errors.root.server.message}
            </Text>
          ) : null}
          <AppButton
            label={review ? 'Actualizar reseña' : 'Enviar reseña'}
            className="rounded-full"
            loading={resource.saving}
            disabled={disabled || (!!review && !isDirty)}
            onPress={() => void submit()}
          />
        </>
      )}
    </AppSheet>
  );
}
export function WriteReviewScreen() {
  const { productId: param } = useLocalSearchParams<{ productId?: string | string[] }>();
  const productId = typeof param === 'string' ? param : '';
  const resource = useWriteReview(productId);
  const { query, productQuery } = resource;
  const { status } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );
  const close = () => {
    if (router.canGoBack()) router.back();
    else if (resource.valid)
      router.replace({ pathname: '/producto/[id]', params: { id: productId } });
    else router.replace('/perfil/resenas');
  };
  if (status === 'authenticated' && resource.valid) {
    if (query.data && productQuery.data) {
      return (
        <ReviewForm
          key={`${resource.userId}:${productId}`}
          resource={resource}
          close={close}
          visible={visible}
        />
      );
    }
    return (
      <AppSheet title="Escribir reseña" visible={visible} onClose={close}>
        <AccountResourceState
          data={undefined}
          isError={query.isError || productQuery.isError}
          error={query.error ?? productQuery.error}
          isOnline={resource.isOnline}
          retry={() => {
            void query.refetch();
            void productQuery.refetch();
          }}
        >
          {null}
        </AccountResourceState>
      </AppSheet>
    );
  }
  return (
    <AppSheet title="Escribir reseña" visible={visible} onClose={close}>
      <AccountAccessBoundary>
        {!resource.valid ? (
          <EmptyState
            title="Producto no válido"
            description="Abre un producto del catálogo para escribir tu reseña."
          />
        ) : null}
      </AccountAccessBoundary>
    </AppSheet>
  );
}
