import { useCallback, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import Smartphone from 'lucide-react-native/icons/smartphone';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { ProfileLayout } from '@/features/profile/components/ProfileLayout';
import { AccountResourceState } from '@/features/profile/components/AccountResourceState';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { colors } from '@/theme';
import { registerNativePush } from './native-push';
import { notificationService } from './notification-service';
import type { NotificationPreferences } from './notification-schemas';
import { useNotificationActions } from './useNotifications';

const rows: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  {
    key: 'pushEnabled',
    label: 'Recibir notificaciones push',
    description: 'Activa o desactiva los avisos en todos tus dispositivos.',
  },
  {
    key: 'system',
    label: 'Sistema y seguridad',
    description: 'Comunicados y cambios de seguridad de tu cuenta.',
  },
  { key: 'offers', label: 'Ofertas', description: 'Promociones y novedades de CEMYDI.' },
  { key: 'rentals', label: 'Rentas', description: 'Estados de solicitudes y revisión de recetas.' },
];

export function NotificationPreferencesScreen() {
  const { user } = useAuth();
  return (
    <ProfileLayout title="Ajustes de notificaciones">
      <PreferencesForm key={user?.id ?? 'guest'} />
    </ProfileLayout>
  );
}
function PreferencesForm() {
  const { user, status } = useAuth();
  const allowed = status === 'authenticated' && user?.rol === 'CLIENT';
  const actions = useNotificationActions();
  const toast = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const changing = useRef(false);
  const queryKey = ['notifications', user?.id, 'preferences'] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => notificationService.preferences(signal),
    enabled: allowed && !draft && !actions.busy,
    gcTime: 0,
    refetchInterval: draft ? false : 30000,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (allowed && !changing.current) void refetch();
    }, [allowed, refetch]),
  );
  const preferences = draft ?? query.data?.preferences;
  const change = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences || changing.current) return;
    changing.current = true;
    const next = { ...preferences, [key]: value };
    setDraft(next);
    try {
      await actions.run(async (isCurrent) => {
        const result = await notificationService.savePreferences(next);
        if (isCurrent()) client.setQueryData(queryKey, result);
      });
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      changing.current = false;
      setDraft(null);
    }
  };
  return (
    <AccountResourceState
      data={query.data}
      error={query.error}
      isError={query.isError}
      isOnline={actions.isOnline}
      allowed={allowed}
      retry={() => void query.refetch()}
    >
      {preferences && (
        <View className="gap-5 px-5 py-5">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
            <Bell size={26} color={colors.brandStrong} aria-hidden />
          </View>
          <View className="gap-2">
            <Text className="font-sans-bold text-2xl text-primary">Tú eliges qué recibir</Text>
          </View>
          <View className="overflow-hidden rounded-2xl bg-surface-muted px-4">
            {rows.map((row) => (
              <View
                key={row.key}
                className={`flex-row items-center justify-between gap-4 py-5 ${row.key === 'pushEnabled' ? 'mb-1 border-b border-border' : ''}`}
              >
                <View className="flex-1 gap-1">
                  <Text className="font-sans-semibold text-base text-primary">{row.label}</Text>
                  <Text className="font-sans text-sm leading-5 text-secondary">
                    {row.description}
                  </Text>
                </View>
                <AppSwitch
                  label={row.label}
                  value={preferences[row.key]}
                  disabled={actions.busy || (row.key !== 'pushEnabled' && !preferences.pushEnabled)}
                  onValueChange={(value) => {
                    void change(row.key, value);
                  }}
                />
              </View>
            ))}
          </View>
          <View className="gap-3 border-t border-border pt-5">
            <View className="flex-row items-center gap-2">
              <Smartphone size={20} color={colors.brandStrong} aria-hidden />
              <Text
                accessibilityRole="header"
                className="font-sans-semibold text-base text-primary"
              >
                En este dispositivo
              </Text>
            </View>
            <Text className="font-sans text-sm leading-5 text-secondary">
              Activa también los permisos del teléfono para recibir avisos fuera de CEMYDI.
            </Text>
            <AppButton
              label="Activar en este dispositivo"
              variant="outline"
              disabled={
                actions.busy ||
                actions.isOnline === false ||
                !query.data?.preferences.pushEnabled ||
                !!draft
              }
              onPress={() => {
                void actions
                  .run((isCurrent) => registerNativePush(isCurrent, true))
                  .then(() => toast.success('Este dispositivo está activado para recibir push.'))
                  .catch((error) => toast.error(getFriendlyErrorMessage(error)));
              }}
            />
            <AppButton
              label="Abrir ajustes del dispositivo"
              variant="ghost"
              onPress={() => {
                void Linking.openSettings().catch(() =>
                  toast.error('No pudimos abrir los ajustes.'),
                );
              }}
            />
          </View>
        </View>
      )}
    </AccountResourceState>
  );
}
