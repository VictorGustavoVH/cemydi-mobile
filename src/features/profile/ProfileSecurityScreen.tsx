import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { PasswordField } from '@/components/ui/PasswordField';
import { AppButton } from '@/components/ui/AppButton';
import { PasswordStrength } from '@/features/auth/components/PasswordStrength';
import { OtpInput } from '@/features/auth/components/OtpInput';
import { OtpResendButton } from '@/features/auth/components/OtpResendButton';
import { OTP_LENGTH, passwordSchema } from '@/features/auth/schemas/auth-schemas';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/providers/auth-provider';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import { colors } from '@/theme';
import { accountSecurityService, type AccountChallenge } from './account-security-service';
import { ProfileLayout } from './components/ProfileLayout';

export function ProfileSecurityScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, logout } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [challenge, setChallenge] = useState<AccountChallenge | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const disabled = pending || isOnline === false;

  async function run(action: () => Promise<void>) {
    if (disabled) return;
    setPending(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No pudimos cambiar la contraseña.'));
    } finally {
      setPending(false);
    }
  }

  const request = () =>
    void run(async () => {
      if (!currentPassword) throw new UserFacingError('Ingresa tu contraseña actual.');
      setChallenge(await accountSecurityService.requestPasswordChange(currentPassword));
      setCurrentPassword('');
      setCodigo('');
    });
  const resend = () =>
    void run(async () => {
      setChallenge(await accountSecurityService.resendPasswordChange());
      setCodigo('');
      toast.info('Enviamos un código nuevo.');
    });
  const confirm = () =>
    void run(async () => {
      if (codigo.length !== OTP_LENGTH)
        throw new UserFacingError('Ingresa los ocho dígitos del código.');
      if (!passwordSchema.safeParse(newPassword).success)
        throw new UserFacingError('La nueva contraseña no cumple los requisitos.');
      if (newPassword !== confirmPassword)
        throw new UserFacingError('Las contraseñas no coinciden.');
      await accountSecurityService.confirmPasswordChange(codigo, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      await logout();
      toast.success('Contraseña actualizada. Inicia sesión nuevamente.');
      router.replace('/login');
    });

  return (
    <ProfileLayout title="Contraseña y acceso">
      <View className="gap-5 px-5 pb-8">
        <View className="gap-3 rounded-2xl bg-brand/5 p-5">
          <ShieldCheck aria-hidden size={28} color={colors.brandStrong} />
          <Text className="font-sans-semibold text-lg text-primary">
            Cuida el acceso a tu cuenta
          </Text>
          <Text className="font-sans text-sm leading-6 text-secondary">
            Al cambiar tu contraseña se cerrarán todas tus sesiones.
          </Text>
        </View>
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
        {isOnline === false ? (
          <Text className="font-sans text-sm text-secondary">Conéctate para continuar.</Text>
        ) : null}
        {error ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
            {error}
          </Text>
        ) : null}
      </View>
    </ProfileLayout>
  );
}
