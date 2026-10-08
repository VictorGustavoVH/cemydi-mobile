import { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/ui/AppButton';
import { useAuthPreview } from '@/providers/auth-preview-provider';
import { AuthLayout } from './components/AuthLayout';
import { PasswordField } from '@/components/ui/PasswordField';
import { PasswordStrength } from './components/PasswordStrength';
import { useAuthAction } from './hooks/useAuthAction';
import { passwordSchema, newPasswordSchema, type NewPasswordValues } from './schemas/auth-schemas';

export function NewPasswordScreen() {
  const router = useRouter();
  const { service, challenge, setChallenge, setUser } = useAuthPreview();
  const { execute, pending } = useAuthAction();
  const {
    control,
    handleSubmit,
    trigger,
    setFocus,
    formState: { touchedFields },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });
  const confirmTouched = touchedFields.confirmPassword;
  useEffect(() => {
    if (confirmTouched) void trigger('confirmPassword');
  }, [password, confirmTouched, trigger]);
  if (!challenge || challenge.purpose !== 'recovery' || !challenge.verified)
    return <Redirect href="/forgot-password" />;
  const submit = handleSubmit((values) =>
    execute(
      () => {
        service.resetPassword(values.password);
      },
      'Contraseña actualizada. Inicia sesión con tu nueva contraseña.',
      () => {
        setChallenge(null);
        setUser(null);
        router.replace('/login');
      },
    ),
  );
  return (
    <AuthLayout
      title="Tu nueva contraseña"
      description="Elige una contraseña segura para proteger tu cuenta."
      backTo="/otp"
      illustration="password"
    >
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            ref={field.ref}
            label="Nueva contraseña"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={fieldState.isDirty && passwordSchema.safeParse(field.value).success}
            returnKeyType="next"
            onSubmitEditing={() => setFocus('confirmPassword')}
            editable={!pending}
            placeholder="Crea una contraseña"
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />
      <PasswordStrength password={password} />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <PasswordField
            ref={field.ref}
            label="Confirmar nueva contraseña"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={
              fieldState.isDirty &&
              field.value === password &&
              passwordSchema.safeParse(field.value).success
            }
            editable={!pending}
            placeholder="Repite tu nueva contraseña"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <AppButton
        label="Guardar contraseña"
        className="min-h-14 rounded-2xl"
        loading={pending}
        onPress={() => void submit()}
      />
    </AuthLayout>
  );
}
