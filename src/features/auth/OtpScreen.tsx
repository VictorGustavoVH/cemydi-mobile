import { useEffect, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Redirect, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/ui/AppButton';
import { useAuthPreview } from '@/providers/auth-preview-provider';
import { AuthLayout } from './components/AuthLayout';
import { OtpInput } from './components/OtpInput';
import { OtpResendButton } from './components/OtpResendButton';
import { useAuthAction } from './hooks/useAuthAction';
import { otpSchema, type OtpValues } from './schemas/auth-schemas';
import type { AuthChallenge } from './services/auth-preview-service';

export function OtpScreen() {
  const router = useRouter();
  const { service, challenge, setChallenge } = useAuthPreview();
  const { pending, execute } = useAuthAction();
  const [verified, setVerified] = useState<{
    next: AuthChallenge | null;
    registration: boolean;
  } | null>(null);
  const reducedMotion = useReducedMotion();
  const locked = pending || verified !== null;
  const { control, handleSubmit, reset } = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { codigo: '' },
  });
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(
      () => {
        setChallenge(verified.next);
        router.replace(verified.registration ? '/login' : '/new-password');
      },
      reducedMotion ? 300 : 550,
    );
    return () => clearTimeout(timer);
  }, [verified, reducedMotion, router, setChallenge]);
  if (!challenge) return <Redirect href="/forgot-password" />;
  const isRegistration = challenge.purpose === 'registration';
  const submit = handleSubmit((values) => {
    if (locked) return;
    let next: AuthChallenge | null = null;
    return execute(
      () => {
        next = service.verify(values.codigo);
      },
      isRegistration ? 'Correo verificado. Ya puedes iniciar sesión.' : 'Código verificado',
      () => {
        Keyboard.dismiss();
        setVerified({ next, registration: isRegistration });
      },
    );
  });
  function resend() {
    if (!challenge || Date.now() < challenge.resendAt || locked) return;
    void execute(
      () => {
        setChallenge(service.resend());
      },
      'Si el correo está registrado, recibirás un código',
      () => {
        reset({ codigo: '' });
      },
    );
  }
  function changeEmail() {
    service.cancelChallenge();
    setChallenge(null);
    router.replace(isRegistration ? '/register' : '/forgot-password');
  }
  return (
    <AuthLayout
      title="Revisa tu correo"
      description={
        isRegistration
          ? 'Confirma tu correo para terminar de crear tu cuenta.'
          : 'Ingresa el código para recuperar el acceso a tu cuenta.'
      }
      backTo={isRegistration ? '/register' : '/forgot-password'}
      illustration="otp"
    >
      <View className="gap-1">
        <Text className="w-full text-center font-sans text-sm text-secondary">
          Enviamos un código de 8 dígitos a
        </Text>
        <Text className="w-full text-center font-sans-semibold text-base text-primary">
          {challenge.correo}
        </Text>
        <AppButton
          label="Cambiar correo"
          variant="ghost"
          className="self-center px-0"
          labelClassName="text-sm text-brand-strong"
          disabled={locked}
          onPress={changeEmail}
        />
      </View>
      <Controller
        control={control}
        name="codigo"
        render={({ field, fieldState }) => (
          <OtpInput
            ref={field.ref}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            disabled={locked}
            verified={verified !== null}
          />
        )}
      />
      <AppButton
        label="Verificar código"
        className="min-h-14 rounded-2xl"
        loading={pending}
        disabled={verified !== null}
        onPress={() => void submit()}
      />
      <View className="items-center gap-1">
        <Text className="font-sans text-sm text-secondary">¿No recibiste el código?</Text>
        <OtpResendButton resendAt={challenge.resendAt} disabled={locked} onResend={resend} />
      </View>
      <AppButton
        label="Volver a iniciar sesión"
        variant="ghost"
        labelClassName="text-sm text-brand-strong"
        disabled={locked}
        onPress={() => {
          service.cancelChallenge();
          setChallenge(null);
          router.replace('/login');
        }}
      />
    </AuthLayout>
  );
}
