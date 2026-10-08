import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Mail from 'lucide-react-native/icons/mail';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { useAuthPreview } from '@/providers/auth-preview-provider';
import { colors } from '@/theme';
import { AuthLayout } from './components/AuthLayout';
import { AuthCheckbox } from './components/AuthCheckbox';
import { AuthTerms } from './components/AuthTerms';
import { GoogleAuthButton } from './components/GoogleAuthButton';
import { PasswordField } from '@/components/ui/PasswordField';
import { useAuthAction } from './hooks/useAuthAction';
import { emailSchema, loginSchema, type LoginValues } from './schemas/auth-schemas';

export function LoginScreen() {
  const router = useRouter();
  const {
    service,
    rememberedEmail,
    setRememberedEmail,
    setUser,
    authDestination,
    setAuthDestination,
  } = useAuthPreview();
  const [remember, setRemember] = useState(Boolean(rememberedEmail));
  const { execute, pending } = useAuthAction();
  const { control, handleSubmit, setFocus } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { correo: rememberedEmail, password: '' },
  });
  const submit = handleSubmit((values) =>
    execute(
      () => {
        const user = service.login(values.correo, values.password);
        setUser(user);
        setRememberedEmail(remember ? user.correo : '');
      },
      'Sesión iniciada correctamente',
      () => {
        router.replace(authDestination);
        setAuthDestination('/inicio');
      },
    ),
  );

  return (
    <AuthLayout
      title="Qué gusto verte"
      description="Inicia sesión y sigue cuidando de tu bienestar."
      backTo={authDestination}
    >
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
            valid={fieldState.isDirty && emailSchema.safeParse(field.value).success}
            editable={!pending}
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
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
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={fieldState.isDirty && Boolean(field.value)}
            editable={!pending}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <View className="flex-row flex-wrap items-center justify-between gap-x-2">
        <AuthCheckbox
          label="Recuérdame"
          checked={remember}
          onChange={setRemember}
          disabled={pending}
        />
        <AppButton
          label="¿Olvidaste tu contraseña?"
          labelClassName="text-sm text-brand-strong"
          variant="ghost"
          className="px-0"
          disabled={pending}
          onPress={() => router.replace('/forgot-password')}
        />
      </View>
      <AppButton
        label="Iniciar sesión"
        className="min-h-14 rounded-2xl"
        loading={pending}
        onPress={() => void submit()}
      />
      <GoogleAuthButton disabled={pending} />
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
