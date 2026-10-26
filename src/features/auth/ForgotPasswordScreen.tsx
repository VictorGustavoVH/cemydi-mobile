import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Mail from 'lucide-react-native/icons/mail';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';
import { AuthLayout } from './components/AuthLayout';
import { useAuthAction } from './hooks/useAuthAction';
import { emailSchema, recoverySchema, type RecoveryValues } from './schemas/auth-schemas';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { service, setChallenge, recoveryEmail, setRecoveryEmail } = useAuth();
  const { execute, pending } = useAuthAction();
  const { control, handleSubmit } = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    mode: 'onTouched',
    defaultValues: { correo: recoveryEmail },
  });
  const submit = handleSubmit((values) =>
    execute(
      async () => {
        setChallenge(await service.requestRecovery(values.correo));
        setRecoveryEmail(values.correo);
      },
      'Si el correo está registrado, recibirás un código',
      () => router.replace('/otp'),
    ),
  );
  return (
    <AuthLayout
      title="¿Olvidaste tu contraseña?"
      description="Ingresa el correo de tu cuenta. Te ayudaremos a recuperar el acceso."
      backTo="/login"
      illustration="recovery"
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
            maxLength={254}
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
            leadingIcon={<Mail aria-hidden color={colors.textSecondary} size={20} />}
          />
        )}
      />
      <AppButton
        label="Enviar código"
        className="min-h-14 rounded-2xl"
        loading={pending}
        onPress={() => void submit()}
      />
      <AppButton
        label="Volver a iniciar sesión"
        variant="ghost"
        labelClassName="text-sm text-brand-strong"
        disabled={pending}
        onPress={() => router.replace('/login')}
      />
    </AuthLayout>
  );
}
