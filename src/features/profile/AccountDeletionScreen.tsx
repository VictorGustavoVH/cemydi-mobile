import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AppButton } from '@/components/ui/AppButton';
import { OtpInput, OtpResendButton } from '@/features/auth';
import { useAccountDeletion } from './useAccountDeletion';
import { AccountSection } from '@/components/account/AccountSection';

export function AccountDeletionScreen() {
  const flow = useAccountDeletion();
  const router = useRouter();
  const disabled = flow.pending || flow.isOnline === false;
  const closing = flow.receipt && flow.receipt.status !== 'WAITING_OBLIGATIONS';
  return (
    <AccountLayout title="Eliminar cuenta" publicAccess={Boolean(closing)} protectCredentials>
      <View className="gap-6 px-6 pb-8 pt-8">
        {!flow.receipt ? (
          <View className="items-center gap-3 pb-2">
            <Text
              accessibilityRole="header"
              className="text-center font-sans-semibold text-2xl leading-8 text-primary"
            >
              {flow.challenge ? 'Verifica tu correo' : '¿Eliminar tu cuenta?'}
            </Text>
            <Text className="text-center font-sans text-sm leading-6 text-secondary">
              {flow.challenge
                ? 'Ingresa el código de ocho dígitos que enviamos a tu correo.'
                : 'Esta acción es definitiva. Necesitarás confirmar por correo.'}
            </Text>
          </View>
        ) : null}
        <AccountSection
          title="Qué sucede con tus datos"
          collapsible={Boolean(flow.challenge || flow.receipt)}
        >
          <Text className="font-sans text-base leading-6 text-primary">
            Borraremos tu perfil, datos de acceso, favoritos, carrito, reseñas, notificaciones y
            recetas almacenadas.
          </Text>
          <Text className="font-sans text-sm leading-6 text-secondary">
            Si tienes rentas, devoluciones o depósitos pendientes, registraremos la solicitud y la
            completaremos automáticamente al resolverlos. Conservaremos el historial de rentas sin
            tus datos personales, según nuestra política de privacidad.
          </Text>
        </AccountSection>
        {flow.receipt ? (
          <>
            <Text accessibilityRole="header" className="font-sans-semibold text-lg text-primary">
              Solicitud registrada
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              className="font-sans text-base leading-6 text-primary"
            >
              {flow.receipt.message}
            </Text>
            <Text selectable className="font-sans text-sm text-secondary">
              Referencia: {flow.receipt.id}
            </Text>
            <AppButton
              label={closing ? 'Volver al inicio' : 'Consultar mis rentas'}
              onPress={() => router.replace(closing ? '/inicio' : '/perfil/rentas')}
            />
          </>
        ) : !flow.available ? (
          <Text className="font-sans text-sm text-secondary">
            Esta opción está disponible para cuentas de cliente.
          </Text>
        ) : flow.query.isPending ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
            Comprobando el estado de tu cuenta…
          </Text>
        ) : flow.query.isError ? (
          <>
            <Text accessibilityRole="alert" className="font-sans text-sm text-danger">
              No pudimos comprobar tu cuenta. Reintenta antes de continuar.
            </Text>
            <AppButton
              label="Reintentar"
              disabled={disabled}
              onPress={() => void flow.query.refetch()}
            />
          </>
        ) : (
          <>
            {flow.query.data?.pendingObligations ? (
              <Text className="font-sans text-sm text-secondary">
                Tienes {flow.query.data.pendingObligations} rentas pendientes de resolver.
              </Text>
            ) : null}
            {!flow.challenge ? (
              <View className="gap-5 border-t border-border/50 pt-5">
                <View className="gap-1">
                  <Text className="text-center font-sans text-sm text-secondary">
                    Recibirás el código en
                  </Text>
                  <Text
                    selectable
                    className="text-center font-sans-medium text-base leading-6 text-primary"
                  >
                    {flow.correo}
                  </Text>
                </View>
                <AppButton
                  label="Enviar código para eliminar mi cuenta"
                  labelClassName="shrink text-center"
                  disabled={disabled}
                  loading={flow.pending}
                  onPress={() => void flow.request()}
                />
              </View>
            ) : (
              <>
                <Text
                  selectable
                  accessibilityLiveRegion="polite"
                  className="text-center font-sans-medium text-base leading-6 text-primary"
                >
                  {flow.correo}
                </Text>
                <OtpInput value={flow.codigo} onChange={flow.setCodigo} disabled={disabled} />
                <OtpResendButton
                  resendAt={Date.parse(flow.challenge.resendAt)}
                  disabled={disabled}
                  onResend={() => void flow.request()}
                />
                <AppButton
                  label="Confirmar eliminación definitiva"
                  labelClassName="shrink text-center"
                  variant="destructive"
                  loading={flow.pending}
                  disabled={disabled || flow.codigo.length !== 8}
                  onPress={() => void flow.confirm()}
                />
                <AppButton
                  label="Conservar mi cuenta"
                  variant="ghost"
                  disabled={flow.pending}
                  onPress={() => router.replace('/perfil')}
                />
              </>
            )}
          </>
        )}
        {flow.isOnline === false ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
            Conéctate para continuar. La eliminación no se envía sin conexión.
          </Text>
        ) : null}
        {flow.error ? (
          <Text accessibilityRole="alert" className="font-sans text-sm text-danger">
            {flow.error}
          </Text>
        ) : null}
      </View>
    </AccountLayout>
  );
}
