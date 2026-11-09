import { OtpInput, OtpResendButton, emailSchema, OTP_LENGTH } from '@/features/auth';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { PasswordField } from '@/components/ui/PasswordField';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/providers/auth-provider';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import { accountSecurityService, type AccountChallenge } from './account-security-service';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountLayout } from '@/components/account/AccountLayout';
import Mail from 'lucide-react-native/icons/mail';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { colors } from '@/theme';
import { ProfileFormHeading } from './components/ProfileFormHeading';

export function ProfileEmailChangeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, logout, getSession, getSessionVersion } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [challenge, setChallenge] = useState<AccountChallenge | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const disabled = pending || isOnline === false;

  async function run(action: (ensureCurrent: () => void) => Promise<void>) {
    if (lock.current || disabled || !user || getSession().user?.id !== user.id) return;
    lock.current = true;
    const version = getSessionVersion();
    const ensureCurrent = () => {
      if (version !== getSessionVersion())
        throw new UserFacingError('La sesión cambió. Vuelve a abrir tu cuenta.');
    };
    setPending(true);
    setError('');
    try {
      await action(ensureCurrent);
    } catch (cause) {
      if (version === getSessionVersion())
        setError(getFriendlyErrorMessage(cause, 'No pudimos completar la solicitud.'));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const request = () =>
    void run(async (ensureCurrent) => {
      const correo = newEmail.trim().toLowerCase();
      const valid = emailSchema.safeParse(correo).success && correo !== user?.correo.toLowerCase();
      if (!valid) throw new UserFacingError('Ingresa un correo válido y diferente al actual.');
      if (!currentPassword) throw new UserFacingError('Ingresa tu contraseña actual.');
      const result = await accountSecurityService.requestEmailChange(correo, currentPassword);
      ensureCurrent();
      setChallenge(result);
      setNewEmail(correo);
      setCurrentPassword('');
      setCodigo('');
    });
  const resend = () =>
    void run(async (ensureCurrent) => {
      const result = await accountSecurityService.resendEmailChange();
      ensureCurrent();
      setChallenge(result);
      setCodigo('');
      toast.info('Enviamos un código nuevo.');
    });
  const confirm = () =>
    void run(async (ensureCurrent) => {
      if (codigo.length !== OTP_LENGTH)
        throw new UserFacingError('Ingresa los ocho dígitos del código.');
      await accountSecurityService.confirmEmailChange(newEmail, codigo);
      ensureCurrent();
      // El backend ya revocó la sesión: el fallo de limpieza local no debe ocultar el éxito.
      await logout().catch(() => undefined);
      toast.success('Correo actualizado. Inicia sesión nuevamente.');
      router.replace('/login');
    });

  return (
    <AccountLayout title="Cambiar correo" protectCredentials>
      <View className="gap-5 px-5 pb-8 pt-5">
        <ProfileFormHeading
          icon={challenge ? ShieldCheck : Mail}
          title={challenge ? 'Verifica tu nuevo correo' : 'Actualiza tu correo'}
          description={
            challenge
              ? 'Abre el mensaje de CEMYDI e ingresa el código de ocho dígitos. Revisa también la carpeta de spam.'
              : 'Usa un correo al que tengas acceso. Allí recibirás el código para autorizar el cambio.'
          }
          step={challenge ? 2 : 1}
        />
        <View className="rounded-xl bg-surface-muted p-4">
          <AccountSection title="Correo actual" icon={Mail} iconTone="info">
            <Text selectable className="font-sans text-base text-secondary">
              {user?.correo}
            </Text>
            <Text className="font-sans text-sm leading-6 text-secondary">
              El cambio se aplicará al confirmar el código del nuevo correo y cerrará tus sesiones.
            </Text>
          </AccountSection>
        </View>
        {!challenge ? (
          <>
            <AppInput
              label="Nuevo correo electrónico"
              value={newEmail}
              valid={
                Boolean(newEmail.trim()) &&
                emailSchema.safeParse(newEmail.trim()).success &&
                newEmail.trim().toLowerCase() !== user?.correo.toLowerCase()
              }
              onChangeText={setNewEmail}
              editable={!disabled}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              maxLength={120}
              leadingIcon={<Mail aria-hidden size={20} color={colors.textSecondary} />}
            />
            <PasswordField
              label="Contraseña actual"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              editable={!disabled}
              autoComplete="current-password"
              textContentType="password"
              maxLength={72}
            />
            <AppButton
              label="Enviar código"
              loading={pending}
              disabled={disabled}
              onPress={request}
            />
          </>
        ) : (
          <>
            <Text
              selectable
              accessibilityLiveRegion="polite"
              className="font-sans-medium text-base leading-6 text-primary"
            >
              Código enviado a {newEmail}
            </Text>
            <OtpInput value={codigo} onChange={setCodigo} disabled={disabled} />
            <AppButton
              label="Confirmar correo"
              loading={pending}
              disabled={disabled || codigo.length !== OTP_LENGTH}
              onPress={confirm}
            />
            <OtpResendButton
              resendAt={Date.parse(challenge.resendAt)}
              disabled={disabled}
              onResend={resend}
            />
            <AppButton
              label="Usar otro correo"
              variant="ghost"
              disabled={disabled}
              onPress={() => {
                setChallenge(null);
                setCodigo('');
              }}
            />
          </>
        )}
        {isOnline === false ? (
          <Text className="font-sans text-sm text-secondary">Conéctate para continuar.</Text>
        ) : null}
        {error ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
            {error}
          </Text>
        ) : null}
      </View>
    </AccountLayout>
  );
}
