import { useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Mail from 'lucide-react-native/icons/mail';
import { AppInput } from '@/components/ui/AppInput';
import { AppButton } from '@/components/ui/AppButton';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountLayout } from '@/components/account/AccountLayout';
import { ProfileDataState } from './components/ProfileDataState';
import { UnsavedAccountChanges } from '@/components/account/UnsavedAccountChanges';
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
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
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
    <View className="gap-6 px-5 pb-8 pt-5">
      <AccountSection title="Datos de contacto">
        <Controller
          control={control}
          name="nombre"
          render={({ field, fieldState }) => (
            <AppInput
              ref={field.ref}
              label="Nombre completo"
              value={editing ? field.value : (user[field.name] ?? '')}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              valid={editing && profileFormSchema.shape.nombre.safeParse(field.value).success}
              editable={editing && !disabled}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              maxLength={120}
              returnKeyType="next"
              onSubmitEditing={() => setFocus('telefono')}
            />
          )}
        />
        <Controller
          control={control}
          name="telefono"
          render={({ field, fieldState }) => (
            <AppInput
              ref={field.ref}
              label="Teléfono (opcional)"
              value={editing ? field.value : (user[field.name] ?? '')}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              valid={
                editing &&
                Boolean(field.value) &&
                profileFormSchema.shape.telefono.safeParse(field.value).success
              }
              editable={editing && !disabled}
              autoComplete="tel"
              textContentType="telephoneNumber"
              keyboardType="phone-pad"
              maxLength={30}
              returnKeyType="next"
              onSubmitEditing={() => setFocus('direccion')}
              placeholder="Ej. +52 789 123 4567"
            />
          )}
        />
      </AccountSection>
      <View className="pt-1">
        <Controller
          control={control}
          name="direccion"
          render={({ field, fieldState }) => (
            <AppInput
              ref={field.ref}
              label="Dirección (opcional)"
              value={editing ? field.value : (user[field.name] ?? '')}
              valid={
                editing &&
                Boolean(field.value.trim()) &&
                profileFormSchema.shape.direccion.safeParse(field.value).success
              }
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              editable={editing && !disabled}
              multiline
              numberOfLines={3}
              maxLength={180}
              autoCapitalize="sentences"
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              placeholder="Calle, número, colonia, ciudad y código postal"
              helperText={`${(editing ? field.value : (user.direccion ?? '')).length}/180 caracteres`}
            />
          )}
        />
      </View>
      <View className="gap-2 border-t border-border/50 pt-6">
        <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
          Correo y acceso
        </Text>
        <AccountMenuItem
          title="Cambiar correo con código"
          description={user.correo}
          iconTone="info"
          icon={Mail}
          disabled={disabled}
          onPress={() => router.push('/perfil/cambiar-correo')}
        />
      </View>
      {errors.root?.server?.message ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-danger">
          {errors.root.server.message}
        </Text>
      ) : null}
      <View className="gap-3 border-t border-border/50 pt-5">
        {!editing ? (
          <AppButton
            label="Modificar datos"
            disabled={disabled}
            onPress={() => {
              setBaseline(user);
              reset(toProfileForm(user));
              setEditing(true);
            }}
          />
        ) : (
          <>
            <AppButton
              label="Guardar cambios"
              loading={profile.saving}
              disabled={disabled || !isDirty}
              onPress={() => void submit()}
            />
            <AppButton
              label="Cancelar"
              variant="ghost"
              disabled={profile.saving}
              onPress={() => {
                reset(toProfileForm(user));
                setEditing(false);
              }}
            />
          </>
        )}
      </View>
      <UnsavedAccountChanges dirty={isDirty} saving={profile.saving} />
    </View>
  );
}
export function EditProfileScreen() {
  const profile = useProfile();
  return (
    <AccountLayout title="Datos personales" protectCredentials>
      <ProfileDataState profile={profile}>
        {profile.query.data ? (
          <ProfileForm key={profile.query.data.id} user={profile.query.data} profile={profile} />
        ) : null}
      </ProfileDataState>
    </AccountLayout>
  );
}
