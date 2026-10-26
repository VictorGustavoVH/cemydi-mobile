import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Mail from 'lucide-react-native/icons/mail';
import UserRound from 'lucide-react-native/icons/user-round';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';
import { colors } from '@/theme';
import { AuthLayout } from './components/AuthLayout';
import { AuthCheckbox } from './components/AuthCheckbox';
import { AuthTerms } from './components/AuthTerms';
import { GoogleAuthButton } from './components/GoogleAuthButton';
import { PasswordField } from '@/components/ui/PasswordField';
import { PasswordStrength } from './components/PasswordStrength';
import { useAuthAction } from './hooks/useAuthAction';
import {
  emailSchema,
  passwordSchema,
  registerSchema,
  type RegisterValues,
} from './schemas/auth-schemas';

export function RegisterScreen() {
  const router = useRouter();
  const toast = useToast();
  const { service, setChallenge, registrationDraft, setRegistrationDraft } = useAuth();
  const { execute, pending } = useAuthAction();
  const {
    control,
    handleSubmit,
    trigger,
    setFocus,
    formState: { touchedFields },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      nombre: registrationDraft.nombre,
      correo: registrationDraft.correo,
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    },
  });
  const password = useWatch({ control, name: 'password' });
  const confirmTouched = touchedFields.confirmPassword;
  useEffect(() => {
    if (confirmTouched) void trigger('confirmPassword');
  }, [password, confirmTouched, trigger]);
  const submit = handleSubmit(
    (values) =>
      execute(
        async () => {
          setChallenge(await service.register(values));
          setRegistrationDraft({ nombre: values.nombre, correo: values.correo });
        },
        'Si la solicitud es válida, recibirás instrucciones por correo',
        () => router.replace('/otp'),
      ),
    (errors) => {
      if (errors.acceptedTerms) toast.error('Acepta los términos y condiciones para registrarte.');
    },
  );

  return (
    <AuthLayout title="Crea tu cuenta" description="Estamos aquí para acompañarte." backTo="/login">
      <Controller
        control={control}
        name="nombre"
        render={({ field, fieldState }) => (
          <AppInput
            ref={field.ref}
            label="Nombre completo"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={fieldState.isDirty && registerSchema.shape.nombre.safeParse(field.value).success}
            returnKeyType="next"
            onSubmitEditing={() => setFocus('correo')}
            editable={!pending}
            placeholder="Tu nombre completo"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            maxLength={100}
            leadingIcon={<UserRound aria-hidden color={colors.textSecondary} size={20} />}
          />
        )}
      />
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
            returnKeyType="next"
            onSubmitEditing={() => setFocus('password')}
            editable={!pending}
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
            leadingIcon={<Mail aria-hidden color={colors.textSecondary} size={20} />}
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
            valid={fieldState.isDirty && passwordSchema.safeParse(field.value).success}
            returnKeyType="next"
            onSubmitEditing={() => setFocus('confirmPassword')}
            editable={!pending}
            placeholder="Crea una contraseña"
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={72}
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
            label="Confirmar contraseña"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={
              fieldState.isDirty &&
              field.value === password &&
              passwordSchema.safeParse(field.value).success
            }
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            editable={!pending}
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={72}
          />
        )}
      />
      <View>
        <Controller
          control={control}
          name="acceptedTerms"
          render={({ field, fieldState }) => (
            <AuthCheckbox
              label="Acepto los términos y condiciones y el aviso de privacidad"
              checked={field.value}
              onChange={(value) => {
                field.onChange(value);
                field.onBlur();
              }}
              error={fieldState.error?.message}
              disabled={pending}
            >
              <AuthTerms registration />
            </AuthCheckbox>
          )}
        />
      </View>
      <AppButton
        label="Crear cuenta"
        className="min-h-14 rounded-2xl"
        loading={pending}
        onPress={() => void submit()}
      />
      <GoogleAuthButton disabled={pending} />
      <View className="flex-row flex-wrap items-center justify-center gap-x-1">
        <Text className="font-sans text-sm text-secondary">¿Ya tienes cuenta?</Text>
        <AppButton
          label="Inicia sesión"
          variant="ghost"
          className="px-1"
          labelClassName="text-sm text-brand-strong"
          disabled={pending}
          onPress={() => router.replace('/login')}
        />
      </View>
    </AuthLayout>
  );
}
