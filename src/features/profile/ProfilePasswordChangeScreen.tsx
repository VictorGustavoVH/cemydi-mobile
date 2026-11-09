import {
  PasswordStrength,
  OtpInput,
  OtpResendButton,
  OTP_LENGTH,
  passwordSchema,
} from '@/features/auth';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PasswordField } from '@/components/ui/PasswordField';
import { AppButton } from '@/components/ui/AppButton';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/providers/auth-provider';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import { accountSecurityService, type AccountChallenge } from './account-security-service';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountSection } from '@/components/account/AccountSection';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { ProfileFormHeading } from './components/ProfileFormHeading';

export function ProfilePasswordChangeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, logout, getSession, getSessionVersion } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        setError(getFriendlyErrorMessage(cause, 'No pudimos cambiar la contraseña.'));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const request = () =>
    void run(async (ensureCurrent) => {
      if (!currentPassword) throw new UserFacingError('Ingresa tu contraseña actual.');
      const result = await accountSecurityService.requestPasswordChange(currentPassword);
      ensureCurrent();
      setChallenge(result);
      setCurrentPassword('');
      setCodigo('');
    });
  const resend = () =>
    void run(async (ensureCurrent) => {
      const result = await accountSecurityService.resendPasswordChange();
      ensureCurrent();
      setChallenge(result);
      setCodigo('');
      toast.info('Enviamos un código nuevo.');
    });
  const confirm = () =>
    void run(async (ensureCurrent) => {
      if (codigo.length !== OTP_LENGTH)
        throw new UserFacingError('Ingresa los ocho dígitos del código.');
      if (!passwordSchema.safeParse(newPassword).success)
        throw new UserFacingError('La nueva contraseña no cumple los requisitos.');
      if (newPassword !== confirmPassword)
        throw new UserFacingError('Las contraseñas no coinciden.');
      await accountSecurityService.confirmPasswordChange(codigo, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      ensureCurrent();
      // El backend ya revocó la sesión: el fallo de limpieza local no debe ocultar el éxito.
      await logout().catch(() => undefined);
      toast.success('Contraseña actualizada. Inicia sesión nuevamente.');
      router.replace('/login');
    });

  return (
    <AccountLayout title="Cambiar contraseña" protectCredentials>
      <View className="gap-5 px-5 pb-8 pt-5">
        <ProfileFormHeading
          icon={ShieldCheck}
          title={challenge ? 'Confirma tu nueva contraseña' : 'Protege tu acceso'}
          description="Confirma el cambio por correo. Se cerrarán todas tus sesiones al actualizar la contraseña."
          step={challenge ? 2 : 1}
        />
        <AccountSection title={challenge ? 'Código y nueva contraseña' : 'Cambiar contraseña'}>
          {!challenge ? (
            <>
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
              <Text className="font-sans text-sm text-secondary">
                Enviamos un código a {user?.correo}. Ingrésalo junto con tu nueva contraseña.
              </Text>
              <OtpInput value={codigo} onChange={setCodigo} disabled={disabled} />
              <OtpResendButton
                resendAt={Date.parse(challenge.resendAt)}
                disabled={disabled}
                onResend={resend}
              />
              <PasswordField
                label="Nueva contraseña"
                value={newPassword}
                valid={passwordSchema.safeParse(newPassword).success}
                onChangeText={setNewPassword}
                editable={!disabled}
                autoComplete="new-password"
                textContentType="newPassword"
                maxLength={72}
              />
              <PasswordStrength password={newPassword} />
              <PasswordField
                label="Confirmar nueva contraseña"
                value={confirmPassword}
                valid={
                  confirmPassword === newPassword &&
                  passwordSchema.safeParse(confirmPassword).success
                }
                onChangeText={setConfirmPassword}
                editable={!disabled}
                autoComplete="new-password"
                textContentType="newPassword"
                maxLength={72}
              />
              <AppButton
                label="Actualizar contraseña"
                loading={pending}
                disabled={disabled || codigo.length !== OTP_LENGTH}
                onPress={confirm}
              />
            </>
          )}
        </AccountSection>
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
