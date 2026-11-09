import { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Mail from 'lucide-react-native/icons/mail';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';
import { AuthLayout } from './components/AuthLayout';
import { AuthHeaderMenu } from './components/AuthHeaderMenu';
import { AuthCheckbox } from './components/AuthCheckbox';
import { AuthTerms } from './components/AuthTerms';
import { GoogleAuthButton } from './components/GoogleAuthButton';
import { PasswordField } from '@/components/ui/PasswordField';
import { useAuthAction } from './hooks/useAuthAction';
import { cancelAuthFlow } from './return-to-auth-destination';
import { useAuthRedirect } from './hooks/useAuthRedirect';
import { LoadingState } from '@/components/ui/LoadingState';
import { emailSchema, loginSchema, type LoginValues } from './schemas/auth-schemas';

export function LoginScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { service, rememberedEmail, setRememberedEmail, status, retrySession, setChallenge } =
    useAuth();
  const [remember, setRemember] = useState(Boolean(rememberedEmail));
  const { execute, pending } = useAuthAction();
  const authenticated = useAuthRedirect(pending);
  const { control, handleSubmit, setFocus, trigger, getValues } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { correo: rememberedEmail, password: '' },
  });
  const submit = handleSubmit((values) =>
    execute(
      async () => {
        await service.login(values.correo, values.password, remember);
        setRememberedEmail(remember ? values.correo : '');
      },
      'Sesión iniciada correctamente',
      () => undefined,
    ),
  );

  async function verifyAccount() {
    if (!(await trigger('correo', { shouldFocus: true }))) return;
    await execute(
      async () => setChallenge(await service.requestVerification(getValues('correo'))),
      'Si la cuenta requiere verificación, recibirás un código',
      () => router.replace('/otp'),
    );
  }

  if (authenticated) return <LoadingState label="Continuando…" />;
  return (
    <AuthLayout
      title="Qué gusto verte"
      description="Inicia sesión y sigue cuidando de tu bienestar."
      onBack={() => cancelAuthFlow(router, navigation.getState())}
      headerAction={
        <AuthHeaderMenu
          disabled={pending || status === 'loading'}
          onVerify={() => void verifyAccount()}
          onHelp={() => router.push('/perfil/ayuda')}
        />
      }
    >
      {status === 'expired' ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
          Tu sesión venció. Inicia sesión para continuar.
        </Text>
      ) : null}
      {status === 'error' ? (
        <AppButton
          label="Reintentar restaurar sesión"
          variant="secondary"
          onPress={() => void retrySession()}
        />
      ) : null}
      <Controller
        control={control}
        name="correo"
        render={({ field, fieldState }) => (
          <AppInput
            ref={field.ref}
            label="Correo electrónico"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={emailSchema.safeParse(field.value).success}
            editable={!pending}
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
            returnKeyType="next"
            onSubmitEditing={() => setFocus('password')}
            leadingIcon={
              <Mail
                aria-hidden
                color={fieldState.error ? colors.danger : colors.textSecondary}
                size={20}
              />
            }
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            ref={field.ref}
            label="Contraseña"
            labelTrailingAction={
              <AppButton
                label="¿Olvidaste tu contraseña?"
                labelClassName="text-right text-sm text-brand-strong"
                variant="unstyled"
                style={{ padding: 0, minHeight: 0 }}
                hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
                disabled={pending}
                onPress={() => router.replace('/forgot-password')}
              >
                <Text
                  className="font-sans-semibold text-brand-strong"
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    includeFontPadding: false,
                    textAlign: 'right',
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Text>
              </AppButton>
            }
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={Boolean(field.value)}
            editable={!pending}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            textContentType="password"
            maxLength={72}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <AuthCheckbox
        label="Mantener sesión iniciada"
        checked={remember}
        onChange={setRemember}
        disabled={pending}
      />
      <AppButton
        label="Iniciar sesión"
        className="min-h-14 rounded-2xl"
        loading={pending || status === 'loading'}
        onPress={() => void submit()}
      />
      <GoogleAuthButton disabled={pending} remember={remember} />
      <View className="flex-row flex-wrap items-center justify-center gap-x-1 pt-2">
        <Text className="font-sans text-sm text-secondary">¿Aún no tienes cuenta?</Text>
        <AppButton
          label="Regístrate"
          variant="ghost"
          className="px-1"
          labelClassName="text-sm text-brand-strong"
          disabled={pending}
          onPress={() => router.replace('/register')}
        />
      </View>
      <AuthTerms />
    </AuthLayout>
  );
}
