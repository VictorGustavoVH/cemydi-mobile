import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { PasswordField } from '@/components/ui/PasswordField';
import { OtpInput } from '@/features/auth/components/OtpInput';
import { OtpResendButton } from '@/features/auth/components/OtpResendButton';
import { emailSchema, OTP_LENGTH } from '@/features/auth/schemas/auth-schemas';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/providers/auth-provider';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import { accountSecurityService, type AccountChallenge } from './account-security-service';
import { ProfileLayout } from './components/ProfileLayout';

export function ProfileEmailChangeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, logout } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
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
      setError(getFriendlyErrorMessage(cause, 'No pudimos completar la solicitud.'));
    } finally {
      setPending(false);
    }
  }

  const request = () =>
    void run(async () => {
      const correo = newEmail.trim().toLowerCase();
      const valid = emailSchema.safeParse(correo).success && correo !== user?.correo.toLowerCase();
      if (!valid) throw new UserFacingError('Ingresa un correo válido y diferente al actual.');
      if (!currentPassword) throw new UserFacingError('Ingresa tu contraseña actual.');
      setChallenge(await accountSecurityService.requestEmailChange(correo, currentPassword));
      setNewEmail(correo);
      setCurrentPassword('');
      setCodigo('');
    });
  const resend = () =>
    void run(async () => {
      setChallenge(await accountSecurityService.resendEmailChange());
      setCodigo('');
      toast.info('Enviamos un código nuevo.');
    });
  const confirm = () =>
    void run(async () => {
      if (codigo.length !== OTP_LENGTH)
        throw new UserFacingError('Ingresa los ocho dígitos del código.');
      await accountSecurityService.confirmEmailChange(newEmail, codigo);
      await logout();
      toast.success('Correo actualizado. Inicia sesión nuevamente.');
      router.replace('/login');
    });

  return (
    <ProfileLayout title="Cambiar correo">
      <View className="gap-5 px-5 pb-8">
        <Text className="font-sans text-sm leading-6 text-secondary">
          Tu correo actual seguirá vigente hasta confirmar el código enviado al nuevo correo.
        </Text>
        <Text selectable className="font-sans-semibold text-base text-primary">
          Correo actual: {user?.correo}
        </Text>
        {!challenge ? (
          <>
            <AppInput
              label="Nuevo correo electrónico"
              value={newEmail}
              onChangeText={setNewEmail}
              editable={!disabled}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              maxLength={120}
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
            <Text className="font-sans text-sm text-secondary">Código enviado a {newEmail}</Text>
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
    </ProfileLayout>
  );
}
