import { useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import UserRound from 'lucide-react-native/icons/user-round';
import Mail from 'lucide-react-native/icons/mail';
import Phone from 'lucide-react-native/icons/phone';
import MapPin from 'lucide-react-native/icons/map-pin';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { colors } from '@/theme';
import { ProfileLayout } from './components/ProfileLayout';
import { ProfileDataState } from './components/ProfileDataState';
import { UnsavedProfileChanges } from './components/UnsavedProfileChanges';
import { useProfile } from './useProfile';
import {
  profileChanges,
  profileFormSchema,
  toProfileForm,
  type ProfileFormValues,
  type ProfileUser,
} from './profile-schemas';

type ProfileFormProps = { user: ProfileUser; profile: ReturnType<typeof useProfile> };
function ProfileForm({ user, profile }: ProfileFormProps) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(user);
  const toast = useToast();
  const {
    control,
    handleSubmit,
    setFocus,
    reset,
    setError,
    formState: { isDirty, errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onTouched',
    defaultValues: toProfileForm(user),
  });
  const disabled = profile.saving || profile.isOnline === false;
  const submit = handleSubmit(async (values) => {
    const changes = profileChanges(values, baseline);
    if (Object.keys(changes).length === 0) {
      reset(values);
      return;
    }
    try {
      const saved = await profile.save(changes);
      setBaseline(saved);
      reset(toProfileForm(saved));
      Keyboard.dismiss();
      toast.success('Tus datos se guardaron correctamente');
    } catch (error) {
      setError('root.server', {
        message: getFriendlyErrorMessage(
          error,
          'No pudimos guardar los cambios. Intenta de nuevo.',
        ),
      });
    }
  });
  return (
    <View className="gap-6 px-5 pb-8">
      <View className="gap-2">
        <Text className="font-sans-semibold text-xl text-primary">Tus datos personales</Text>
        <Text className="font-sans text-sm leading-6 text-secondary">
          Mantén actualizada tu información de contacto.
        </Text>
      </View>
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
            valid={
              fieldState.isDirty && profileFormSchema.shape.nombre.safeParse(field.value).success
            }
            editable={!disabled}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            maxLength={120}
            returnKeyType="next"
            onSubmitEditing={() => setFocus('telefono')}
            leadingIcon={<UserRound aria-hidden size={20} color={colors.textSecondary} />}
          />
        )}
      />
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Mail aria-hidden size={20} color={colors.textSecondary} />
          <Text className="font-sans-semibold text-base text-primary">Correo electrónico</Text>
        </View>
        <Text selectable className="font-sans text-sm text-secondary">
          {user.correo}
        </Text>
        <AppButton
          label="Cambiar correo con código"
          variant="secondary"
          disabled={disabled}
          onPress={() => router.push('/perfil/cambiar-correo')}
        />
      </View>
      <Controller
        control={control}
        name="telefono"
        render={({ field, fieldState }) => (
          <AppInput
            ref={field.ref}
            label="Teléfono (opcional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            valid={
              fieldState.isDirty &&
              Boolean(field.value) &&
              profileFormSchema.shape.telefono.safeParse(field.value).success
            }
            editable={!disabled}
            autoComplete="tel"
            textContentType="telephoneNumber"
            keyboardType="phone-pad"
            maxLength={30}
            returnKeyType="next"
            onSubmitEditing={() => setFocus('direccion')}
            placeholder="Ej. +52 55 1234 5678"
            leadingIcon={<Phone aria-hidden size={20} color={colors.textSecondary} />}
          />
        )}
      />
      <View className="gap-4 pt-2">
        <View className="gap-1">
          <Text accessibilityRole="header" className="font-sans-semibold text-lg text-primary">
            Dirección de contacto
          </Text>
          <Text className="font-sans text-sm leading-5 text-secondary">
            Es opcional. Podrás confirmar el domicilio de entrega al solicitar una renta.
          </Text>
        </View>
        <Controller
          control={control}
          name="direccion"
          render={({ field, fieldState }) => (
            <AppInput
              ref={field.ref}
              label="Dirección (opcional)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              editable={!disabled}
              multiline
              numberOfLines={3}
              style={{ minHeight: 104, textAlignVertical: 'top' }}
              maxLength={180}
              autoCapitalize="sentences"
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              placeholder="Calle, número, colonia, ciudad y código postal"
              helperText={`${field.value.length}/180 caracteres`}
              leadingIcon={<MapPin aria-hidden size={20} color={colors.textSecondary} />}
            />
          )}
        />
      </View>
      {errors.root?.server?.message ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-danger">
          {errors.root.server.message}
        </Text>
      ) : null}
      <AppButton
        label="Guardar cambios"
        loading={profile.saving}
        disabled={disabled || !isDirty}
        onPress={() => void submit()}
      />
      <UnsavedProfileChanges dirty={isDirty} saving={profile.saving} />
    </View>
  );
}
export function EditProfileScreen() {
  const profile = useProfile();
  return (
    <ProfileLayout title="Editar perfil">
      <ProfileDataState profile={profile}>
        {profile.query.data ? (
          <ProfileForm key={profile.query.data.id} user={profile.query.data} profile={profile} />
        ) : null}
      </ProfileDataState>
    </ProfileLayout>
  );
}
