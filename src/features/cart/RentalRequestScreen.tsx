import { useRef, useState } from 'react';
import { Keyboard, Text, View, type TextInputProps } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthCheckbox } from '@/features/auth';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Store from 'lucide-react-native/icons/store';
import UserRound from 'lucide-react-native/icons/user-round';
import Package from 'lucide-react-native/icons/package';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import Animated, { cubicBezier, FadeIn, useReducedMotion } from 'react-native-reanimated';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { FormStepProgress } from '@/components/account/FormStepProgress';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppTimeInput } from '@/components/ui/AppTimeInput';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineState } from '@/components/ui/OfflineState';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { useToast } from '@/hooks/useToast';
import {
  rentalRequirementsSchema,
  type RentalRequestInput,
} from '@/services/rentals/rental-request';
import type { Rental } from '@/services/rentals/rental-schemas';
import { colors } from '@/theme';
import { RentalPendingDot } from './components/RentalPendingDot';
import { RentalConfigurationSheet } from './components/RentalConfigurationSheet';
import { RentalSuccessCheckmark } from './components/RentalSuccessCheckmark';
import { rentalDateErrors } from './rental-dates';
import { useRentalToday } from './useRentalToday';
import { displayDraftDate, formatPreviewMoney } from './cart-preview';

type TextField = {
  [K in keyof RentalRequestInput]: RentalRequestInput[K] extends string ? K : never;
}[keyof RentalRequestInput];

function RentalRequestForm() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const {
    cart,
    entries,
    query,
    online,
    busy,
    uncertain,
    refreshCart,
    submitRental,
    userId,
    authVersion,
    isCurrent,
  } = useCart();
  const [step, setStep] = useState<1 | 2>(1);
  const [receipt, setReceipt] = useState<{ message: string; rental: Rental }>();
  const toast = useToast();
  const [configuring, setConfiguring] = useState<number>();
  const lock = useRef(false);
  const { control, handleSubmit, getValues } = useForm<RentalRequestInput>({
    resolver: zodResolver(rentalRequirementsSchema),
    mode: 'onTouched',
    defaultValues: {
      applicantName: user?.nombre ?? '',
      applicantEmail: user?.correo ?? '',
      applicantPhone: '',
      isForAnotherPerson: false,
      patientName: '',
      patientRelationship: '',
      patientRelationshipOther: '',
      deliveryMethod: 'PICKUP',
      deliveryAddress: '',
      deliveryNeighborhood: '',
      deliveryPostalCode: '',
      deliveryMunicipality: '',
      deliveryReferences: '',
      preferredSchedule: '',
      generalNotes: '',
      acceptRentalTerms: false,
      acceptPrivacy: false,
    },
  });
  const [anotherPerson, terms, privacy, relationship] = useWatch({
    control,
    name: ['isForAnotherPerson', 'acceptRentalTerms', 'acceptPrivacy', 'patientRelationship'],
  });
  const today = useRentalToday();
  const rentalItems = cart?.items.filter((item) => item.mode === 'RENTA') ?? [];
  const rentalChecks = rentalItems.map((item) => ({
    item,
    needsPrescription: item.product.requiereReceta && !item.document,
    problems: [
      ...(item.rentalStartDate &&
      rentalDateErrors(item.rentalStartDate.slice(0, 10), item.rentalEndDate?.slice(0, 10), today)
        .start
        ? [`${item.product.nombre}: corrige la fecha de inicio; no puede estar en el pasado.`]
        : []),
      ...(item.rentalEndDate &&
      rentalDateErrors(item.rentalStartDate?.slice(0, 10), item.rentalEndDate.slice(0, 10), today)
        .end
        ? [`${item.product.nombre}: corrige la fecha de devolución.`]
        : []),
      ...(item.configurationStatus === 'PENDING'
        ? [`${item.product.nombre}: elige fechas válidas.`]
        : []),
      ...(!item.availability.isAvailable
        ? [`${item.product.nombre}: ${item.availability.reason ?? 'sin disponibilidad'}.`]
        : []),
    ],
  }));
  const blockers = rentalChecks.flatMap(({ item, problems, needsPrescription }) => [
    ...problems,
    ...(needsPrescription ? [`${item.product.nombre}: adjunta la receta.`] : []),
  ]);
  const incompleteCount = rentalChecks.filter(
    ({ problems, needsPrescription }) => problems.length > 0 || needsPrescription,
  ).length;
  const disabled = busy || !online || uncertain;
  const configured = entries.find(({ item }) => item.serverId === configuring);
  function input(name: TextField, label: string, maxLength: number, props: TextInputProps = {}) {
    return (
      <Controller
        key={name}
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <AppInput
            {...props}
            ref={field.ref}
            label={label}
            maxLength={maxLength}
            value={
              name === 'applicantPhone'
                ? field.value.replace(/^(\d{3})(\d{1,3})?(\d{1,4})?$/, (_, a, b, c) =>
                    [a, b, c].filter(Boolean).join(' '),
                  )
                : field.value
            }
            valid={
              field.value.trim().length > 0 &&
              !fieldState.invalid &&
              rentalRequirementsSchema.shape[name].safeParse(field.value).success
            }
            onChangeText={(value) =>
              field.onChange(
                name === 'applicantPhone' ? value.replace(/\D/g, '').slice(0, 10) : value,
              )
            }
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            editable={!busy}
          />
        )}
      />
    );
  }
  async function send(values: RentalRequestInput) {
    if (lock.current || disabled || blockers.length || !terms || !privacy || !rentalItems.length)
      return;
    if (
      rentalItems.some((item) => {
        const errors = rentalDateErrors(
          item.rentalStartDate?.slice(0, 10),
          item.rentalEndDate?.slice(0, 10),
        );
        return errors.start || errors.end;
      })
    ) {
      toast.error(
        'Revisa las fechas: no se pueden enviar rentas con fechas pasadas o un periodo inválido.',
      );
      return;
    }
    lock.current = true;
    const version = authVersion();
    try {
      const result = await submitRental(values);
      if (isCurrent(userId, version)) setReceipt(result);
    } catch (error) {
      if (isCurrent(userId, version)) toast.error(getFriendlyErrorMessage(error));
    } finally {
      lock.current = false;
    }
  }
  const next = handleSubmit(() => {
    Keyboard.dismiss();
    setStep(2);
  });
  function invalid() {
    // Invalid fields may have changed while the review was open; bring them back into view.
    setStep(1);
  }
  return (
    <AppScreen key={receipt ? 'receipt' : step} scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="flex-row items-center gap-3 px-5 py-2">
        <BackButton
          fallbackHref="/carrito"
          onPress={
            step === 2 && !receipt
              ? () => {
                  if (!busy) setStep(1);
                }
              : undefined
          }
        />
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-sans-semibold text-xl text-primary"
        >
          {receipt ? 'Solicitud enviada' : 'Solicitar renta'}
        </Text>
        <View className="w-11" />
      </View>
      {receipt ? (
        <View className="gap-6 px-5 pb-8 pt-4">
          <View className="items-center gap-3 pt-2">
            <RentalSuccessCheckmark />
            <View className="items-center gap-2 pt-1">
              <Text
                accessibilityRole="header"
                className="text-center font-sans-bold text-2xl text-primary"
              >
                Recibimos tu solicitud
              </Text>
              <Text className="text-center font-sans text-base leading-6 text-secondary">
                Tu solicitud quedó registrada. CEMYDI revisará la disponibilidad y las recetas
                adjuntas.
              </Text>
            </View>
            <View className="flex-row flex-wrap items-center justify-center gap-2 pt-1">
              <View className="flex-row items-center gap-1.5 rounded-full border border-brand/25 bg-brand-muted px-3.5 py-1.5">
                <ReceiptText aria-hidden size={16} color={colors.brandStrong} />
                <Text
                  accessibilityLiveRegion="polite"
                  className="font-sans-semibold text-sm text-brand-strong"
                >
                  {receipt.rental.folio ?? 'Solicitud registrada'}
                </Text>
              </View>
              <AccountStatusBadge kind="rental" status={receipt.rental.status} />
            </View>
          </View>
          <Animated.View
            className="gap-5"
            style={{
              animationName: {
                from: {
                  opacity: 0,
                  transform: reducedMotion ? [] : [{ translateY: 8 }, { scale: 0.98 }],
                },
                to: {
                  opacity: 1,
                  transform: reducedMotion ? [] : [{ translateY: 0 }, { scale: 1 }],
                },
              },
              animationDuration: reducedMotion ? 80 : 240,
              animationDelay: reducedMotion ? 0 : 120,
              animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
              animationFillMode: 'both',
            }}
          >
            <View className="gap-4 rounded-2xl border border-border-subtle bg-surface-muted p-5">
              {receipt.rental.items.length > 0 ? (
                <View className="gap-3 border-b border-border/60 pb-4">
                  <View className="flex-row items-center gap-2">
                    <Package aria-hidden size={18} color={colors.brandStrong} />
                    <Text
                      accessibilityRole="header"
                      className="font-sans-semibold text-base text-primary"
                    >
                      Equipos solicitados
                    </Text>
                  </View>
                  {receipt.rental.items.map((item) => (
                    <View key={item.id} className="gap-1">
                      <View className="flex-row flex-wrap items-start justify-between gap-2">
                        <Text className="min-w-0 flex-1 font-sans-medium text-sm text-primary">
                          {item.product.nombre} · {item.quantity}{' '}
                          {item.quantity === 1 ? 'unidad' : 'unidades'}
                        </Text>
                        <Text className="font-sans-semibold text-sm text-primary">
                          {formatPreviewMoney(item.lineTotal)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <CalendarDays aria-hidden size={14} color={colors.textSecondary} />
                        <Text className="font-sans text-xs leading-5 text-secondary">
                          {displayDraftDate(item.startDate.slice(0, 10))} al{' '}
                          {displayDraftDate(item.endDate.slice(0, 10))} · {item.days}{' '}
                          {item.days === 1 ? 'día' : 'días'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              <View className="gap-2.5">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text className="font-sans text-sm text-secondary">Renta</Text>
                  <Text className="font-sans-medium text-sm text-primary">
                    {formatPreviewMoney(receipt.rental.subtotal)}
                  </Text>
                </View>
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text className="font-sans text-sm text-secondary">Depósito en garantía</Text>
                  <Text className="font-sans-medium text-sm text-primary">
                    {formatPreviewMoney(receipt.rental.depositTotal)}
                  </Text>
                </View>
                <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <Text className="font-sans-semibold text-base text-primary">
                    Total solicitado
                  </Text>
                  <Text
                    accessibilityLabel={`Total solicitado: ${formatPreviewMoney(receipt.rental.total)}`}
                    className="font-sans-bold text-xl text-brand-strong"
                  >
                    {formatPreviewMoney(receipt.rental.total)}
                  </Text>
                </View>
              </View>
              <View className="gap-1.5 rounded-xl border border-border-subtle bg-surface p-4">
                <View className="flex-row items-center gap-2">
                  <Store aria-hidden size={18} color={colors.brandStrong} />
                  <Text className="flex-1 font-sans-semibold text-sm text-primary">
                    {receipt.rental.deliveryMethod === 'HOME_DELIVERY'
                      ? 'Entrega a domicilio'
                      : 'Recoger en sucursal'}
                  </Text>
                </View>
                <Text className="font-sans text-sm leading-6 text-secondary">
                  Estado: pendiente de revisión. Puedes consultar su seguimiento en Mis rentas.
                </Text>
              </View>
            </View>
            <View className="gap-3">
              <AppButton
                label="Ver mi solicitud"
                rightIcon={<ArrowRight aria-hidden size={20} color={colors.onBrand} />}
                onPress={() =>
                  router.replace({
                    pathname: '/perfil/renta/[id]',
                    params: { id: receipt.rental.id },
                  })
                }
              />
              <AppButton
                label="Volver al carrito"
                variant="secondary"
                onPress={() => router.replace('/carrito')}
              />
            </View>
          </Animated.View>
        </View>
      ) : !cart ? (
        !online ? (
          <OfflineState />
        ) : query.isError ? (
          <ErrorState onRetry={() => void refreshCart()} />
        ) : (
          <LoadingState label="Cargando productos de renta" />
        )
      ) : rentalItems.length === 0 ? (
        <EmptyState
          title="Sin rentas en el carrito"
          description="Consulta tus solicitudes o elige un equipo del catálogo para rentar."
          actionLabel="Ver mis rentas"
          onAction={() => router.replace('/perfil/rentas')}
        />
      ) : (
        <Animated.View
          key={step}
          entering={reducedMotion ? undefined : FadeIn.duration(180)}
          className="gap-7 px-5 pb-8 pt-4"
        >
          <View className="gap-3">
            <FormStepProgress step={step} steps={['Tus datos', 'Revisar solicitud']} />
            <Text accessibilityRole="header" className="font-sans-bold text-2xl text-primary">
              {step === 1 ? 'Completa tu solicitud' : 'Todo listo para revisar'}
            </Text>
            <Text className="font-sans text-base leading-7 text-secondary">
              {step === 1
                ? 'Completa tus datos para recoger el equipo en sucursal.'
                : 'Revisa las fechas, adjunta las recetas requeridas y confirma tus datos.'}
            </Text>
          </View>
          {!online ? (
            <Text
              accessibilityLiveRegion="polite"
              className="font-sans text-sm leading-6 text-danger"
            >
              Sin conexión. Puedes revisar tus datos; conéctate para guardar o enviar.
            </Text>
          ) : null}
          {uncertain ? (
            <View className="gap-2">
              <Text
                accessibilityLiveRegion="assertive"
                className="font-sans text-sm leading-6 text-danger"
              >
                No pudimos confirmar el resultado. Consulta Mis rentas y actualiza el carrito antes
                de volver a intentar.
              </Text>
              <AppButton
                label="Consultar mis rentas"
                variant="outline"
                onPress={() => router.push('/perfil/rentas')}
              />
              <AppButton
                label="Comprobar carrito"
                variant="ghost"
                disabled={busy || !online}
                onPress={() => void refreshCart()}
              />
            </View>
          ) : null}
          {query.isError ? (
            <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
              No pudimos actualizar el carrito. {getFriendlyErrorMessage(query.error)}
            </Text>
          ) : null}
          {step === 1 ? (
            <>
              <View className="gap-4">
                <View className="flex-row items-center gap-2">
                  <UserRound aria-hidden size={20} color={colors.brandStrong} />
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg text-primary"
                  >
                    Datos del solicitante
                  </Text>
                </View>
                {input('applicantName', 'Nombre completo', 160, {
                  autoComplete: 'name',
                  textContentType: 'name',
                })}
                {input('applicantEmail', 'Correo electrónico', 190, {
                  keyboardType: 'email-address',
                  autoCapitalize: 'none',
                  autoCorrect: false,
                  autoComplete: 'email',
                })}
                {input('applicantPhone', 'Teléfono de contacto', 12, {
                  keyboardType: 'phone-pad',
                  autoComplete: 'tel',
                  textContentType: 'telephoneNumber',
                  placeholder: '789 123 4567',
                })}
                <View className="flex-row items-center justify-between gap-4 border-t border-border/50 pt-5">
                  <Text className="flex-1 font-sans-medium text-base text-primary">
                    El equipo es para otra persona
                  </Text>
                  <Controller
                    control={control}
                    name="isForAnotherPerson"
                    render={({ field }) => (
                      <AppSwitch
                        label="El equipo es para otra persona"
                        value={field.value}
                        disabled={busy}
                        onValueChange={field.onChange}
                      />
                    )}
                  />
                </View>
                {anotherPerson ? (
                  <Animated.View
                    entering={reducedMotion ? undefined : FadeIn.duration(160)}
                    className="gap-4 border-l-2 border-brand/30 pl-4"
                  >
                    {input('patientName', 'Nombre del paciente', 160)}
                    <Controller
                      control={control}
                      name="patientRelationship"
                      render={({ field, fieldState }) => (
                        <View className="gap-2">
                          <Text className="font-sans-semibold text-base text-primary">
                            Relación con el paciente
                          </Text>
                          <View
                            accessibilityRole="radiogroup"
                            accessibilityLabel="Relación con el paciente"
                            className="flex-row flex-wrap gap-2"
                          >
                            {[
                              ['Madre/Padre', 'Madre o padre'],
                              ['Hija/Hijo', 'Hija o hijo'],
                              ['Pareja', 'Pareja'],
                              ['Familiar', 'Otro familiar'],
                              ['Cuidador', 'Persona cuidadora'],
                              ['Otro', 'Otro'],
                            ].map(([value, label]) => (
                              <AppButton
                                key={value}
                                label={label}
                                variant={field.value === value ? 'primary' : 'secondary'}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: field.value === value }}
                                disabled={busy}
                                onPress={() => field.onChange(value)}
                              />
                            ))}
                          </View>
                          {fieldState.error ? (
                            <Text
                              accessibilityLiveRegion="polite"
                              className="font-sans text-sm text-danger"
                            >
                              {fieldState.error.message}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    />
                    {relationship === 'Otro'
                      ? input('patientRelationshipOther', 'Especifica la relación', 120)
                      : null}
                  </Animated.View>
                ) : null}
              </View>
              <View className="gap-4 border-t border-border/50 pt-6">
                <View className="flex-row items-center gap-2">
                  <Store aria-hidden size={20} color={colors.brandStrong} />
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg text-primary"
                  >
                    Recogida del equipo
                  </Text>
                </View>
                <View className="flex-row items-start gap-3 border-l-2 border-brand py-2 pl-4">
                  <View className="flex-1 gap-1">
                    <Text className="font-sans-semibold text-base text-primary">
                      Recoger en sucursal
                    </Text>
                  </View>
                </View>
                <Controller
                  control={control}
                  name="preferredSchedule"
                  render={({ field, fieldState }) => (
                    <AppTimeInput
                      label="Horario de recogida (opcional)"
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        field.onBlur();
                      }}
                      disabled={busy}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Text className="font-sans text-sm leading-6 text-secondary">
                  CEMYDI confirmará la disponibilidad y el horario de recogida al revisar tu
                  solicitud.
                </Text>
                {input('generalNotes', 'Notas generales (opcional)', 1000, {
                  multiline: true,
                  style: { minHeight: 96, textAlignVertical: 'top' },
                })}
              </View>
              <AppButton label="Revisar solicitud" disabled={busy} onPress={() => void next()} />
            </>
          ) : (
            <>
              <View className="gap-2 border-b border-border/50 pb-5">
                <View className="flex-row items-center gap-2">
                  <UserRound aria-hidden size={20} color={colors.brandStrong} />
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg text-primary"
                  >
                    Solicitante y recogida
                  </Text>
                </View>
                <Text className="font-sans text-base leading-7 text-primary">
                  {getValues('applicantName')}
                  {'\n'}
                  {getValues('applicantEmail')}
                  {'\n'}
                  {getValues('applicantPhone')}
                </Text>
                {anotherPerson ? (
                  <Text className="font-sans text-sm leading-6 text-secondary">
                    Paciente: {getValues('patientName')} ·{' '}
                    {getValues('patientRelationship') === 'Otro'
                      ? getValues('patientRelationshipOther')
                      : getValues('patientRelationship')}
                  </Text>
                ) : null}
                <Text className="font-sans text-sm leading-6 text-secondary">
                  Recoger en sucursal
                </Text>
                {getValues('preferredSchedule') ? (
                  <Text className="font-sans text-sm text-secondary">
                    Horario: {getValues('preferredSchedule')}
                  </Text>
                ) : null}

                {getValues('generalNotes') ? (
                  <Text className="font-sans text-sm text-secondary">
                    Notas: {getValues('generalNotes')}
                  </Text>
                ) : null}
                <AppButton
                  label="Editar datos"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setStep(1)}
                />
              </View>
              <View className="gap-4">
                <View className="flex-row items-center gap-2">
                  <Package aria-hidden size={20} color={colors.brandStrong} />
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg text-primary"
                  >
                    Equipos y documentos
                  </Text>
                </View>
                <Text className="font-sans text-sm leading-6 text-secondary">
                  Se enviarán todas las rentas del carrito. Los productos de compra se conservan
                  para después.
                </Text>
                {rentalChecks.map(({ item, problems, needsPrescription }) => (
                  <View key={item.id} className="gap-3 border-b border-border/50 py-4">
                    <View className="flex-row flex-wrap items-start justify-between gap-3">
                      <Text className="min-w-0 flex-1 font-sans-semibold text-base text-primary">
                        {item.product.nombre} · {item.quantity}{' '}
                        {item.quantity === 1 ? 'unidad' : 'unidades'}
                      </Text>
                      <Text className="font-sans-semibold text-base text-primary">
                        {item.rentalSummary?.total == null
                          ? 'Por confirmar'
                          : formatPreviewMoney(item.rentalSummary.total)}
                      </Text>
                    </View>
                    {problems.length > 0 || needsPrescription ? (
                      <View className="flex-row items-center gap-2">
                        <RentalPendingDot />
                        <Text className="flex-1 font-sans-medium text-sm text-primary">
                          Pendiente de completar
                        </Text>
                      </View>
                    ) : null}
                    {problems.map((problem) => (
                      <Text key={problem} className="font-sans text-sm leading-6 text-secondary">
                        {problem}
                      </Text>
                    ))}
                    <Text className="font-sans text-sm leading-6 text-secondary">
                      {item.rentalStartDate && item.rentalEndDate
                        ? `${displayDraftDate(item.rentalStartDate.slice(0, 10))} al ${displayDraftDate(item.rentalEndDate.slice(0, 10))} · ${item.rentalDays} días`
                        : 'Falta elegir fechas'}
                    </Text>
                    {item.rentalNotes ? (
                      <Text className="font-sans text-sm text-secondary">
                        Notas: {item.rentalNotes}
                      </Text>
                    ) : null}
                    {item.product.rentalTerms ? (
                      <Text className="font-sans text-sm leading-6 text-secondary">
                        {item.product.rentalTerms}
                      </Text>
                    ) : null}
                    <AppButton
                      label={
                        problems.length || needsPrescription
                          ? 'Terminar de configurar'
                          : 'Configurar renta'
                      }
                      accessibilityLabel={`Configurar renta de ${item.product.nombre}`}
                      variant="ghost"
                      disabled={disabled}
                      onPress={() => setConfiguring(item.id)}
                    />
                    {item.document ? (
                      <Text className="font-sans text-sm text-secondary">
                        Receta adjunta: {item.document.originalFilename}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
              <View className="gap-4 rounded-xl bg-surface-muted p-5">
                <View className="flex-row items-center gap-2">
                  <ReceiptText aria-hidden size={20} color={colors.brandStrong} />
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg text-primary"
                  >
                    Resumen de renta
                  </Text>
                </View>
                <View className="flex-row flex-wrap justify-between gap-2">
                  <Text className="font-sans text-base text-secondary">Renta</Text>
                  <Text className="font-sans-medium text-base text-primary">
                    {formatPreviewMoney(cart.summary.rentalSubtotal)}
                  </Text>
                </View>
                <View className="flex-row flex-wrap justify-between gap-2">
                  <Text className="font-sans text-base text-secondary">Depósito</Text>
                  <Text className="font-sans-medium text-base text-primary">
                    {formatPreviewMoney(cart.summary.rentalDepositTotal)}
                  </Text>
                </View>
                <Text className="font-sans text-sm leading-6 text-secondary">
                  El depósito es una garantía. Su devolución se registra al finalizar la renta.
                </Text>
                {cart.summary.hasUnconfiguredRentalItems ? (
                  <Text className="font-sans-medium text-base text-danger">
                    Configura las fechas para conocer el total.
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <Text className="font-sans-semibold text-base text-primary">
                      Total solicitado
                    </Text>
                    <Text className="font-sans-bold text-xl text-brand-strong">
                      {formatPreviewMoney(
                        cart.summary.rentalSubtotal + cart.summary.rentalDepositTotal,
                      )}
                    </Text>
                  </View>
                )}
              </View>
              {blockers.length ? (
                <View accessibilityLiveRegion="polite" className="gap-2">
                  <Text className="font-sans-semibold text-base text-danger">Antes de enviar</Text>
                  <Text className="font-sans text-sm leading-6 text-secondary">
                    {incompleteCount}{' '}
                    {incompleteCount === 1 ? 'equipo pendiente' : 'equipos pendientes'}. Completa
                    los campos marcados arriba.
                  </Text>
                </View>
              ) : null}
              <View className="gap-4 border-t border-border/50 pt-5">
                <Text
                  accessibilityRole="header"
                  className="font-sans-semibold text-lg text-primary"
                >
                  Condiciones de la solicitud
                </Text>
                {(['acceptRentalTerms', 'acceptPrivacy'] as const).map((name) => (
                  <View key={name} className="gap-1 border-b border-border/50 pb-3">
                    <Controller
                      control={control}
                      name={name}
                      render={({ field, fieldState }) => (
                        <AuthCheckbox
                          label={
                            name === 'acceptRentalTerms'
                              ? 'Acepto las condiciones de renta'
                              : 'Acepto el tratamiento de datos y documentos'
                          }
                          checked={field.value}
                          onChange={field.onChange}
                          disabled={busy}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                    <AppButton
                      label={
                        name === 'acceptRentalTerms'
                          ? 'Leer condiciones de renta'
                          : 'Leer políticas de privacidad'
                      }
                      variant="ghost"
                      className="ml-7 self-start px-0 py-2"
                      labelClassName="text-sm underline"
                      onPress={() =>
                        router.push({
                          pathname: '/perfil/legal/[slug]',
                          params: {
                            slug:
                              name === 'acceptRentalTerms'
                                ? 'terminos-y-condiciones'
                                : 'politicas-de-privacidad',
                          },
                        })
                      }
                    />
                  </View>
                ))}
              </View>
              <Text className="font-sans text-sm leading-6 text-secondary">
                El envío inicia una revisión de disponibilidad y documentos. La renta queda
                pendiente hasta que CEMYDI la apruebe.
              </Text>
              <AppButton
                label="Enviar solicitud de renta"
                loading={busy}
                disabled={disabled || blockers.length > 0 || !terms || !privacy}
                onPress={() => void handleSubmit(send, invalid)()}
              />
            </>
          )}
        </Animated.View>
      )}
      {configured ? (
        <RentalConfigurationSheet {...configured} onClose={() => setConfiguring(undefined)} />
      ) : null}
    </AppScreen>
  );
}

export function RentalRequestScreen() {
  const { user, status, getSessionVersion } = useAuth();
  const { requestAccess } = useAccountAccess();
  if (status === 'authenticated' && user?.rol === 'CLIENT')
    return <RentalRequestForm key={`${user.id}-${getSessionVersion()}`} />;
  return (
    <AppScreen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="px-5 py-2">
        <BackButton fallbackHref="/carrito" />
      </View>
      {status === 'loading' ? (
        <LoadingState label="Comprobando tu sesión" />
      ) : (
        <EmptyState
          title={user ? 'Disponible para clientes' : 'Inicia sesión para solicitar una renta'}
          description="Tus solicitudes y documentos se guardan en tu cuenta de cliente."
          actionLabel={user ? undefined : 'Iniciar sesión'}
          onAction={user ? undefined : () => requestAccess('/carrito')}
        />
      )}
    </AppScreen>
  );
}
