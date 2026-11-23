import { useCallback, useRef, useState } from 'react';
import { Linking, Text, useWindowDimensions, View } from 'react-native';
import Smartphone from 'lucide-react-native/icons/smartphone';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { registerNativePush } from './native-push';
import { notificationService } from './notification-service';
import type { NotificationPreferences } from './notification-schemas';
import { useNotificationActions } from './useNotifications';

const rows: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  {
    key: 'pushEnabled',
    label: 'Recibir notificaciones',
    description: 'Activa o desactiva los avisos en todos tus dispositivos.',
  },
  {
    key: 'system',
    label: 'Sistema y seguridad',
    description: 'Comunicados, revisión de reseñas y cambios de seguridad de tu cuenta.',
  },
  {
    key: 'offers',
    label: 'Ofertas',
    description: 'Recibe avisos sobre promociones y ofertas.',
  },
  { key: 'rentals', label: 'Rentas', description: 'Estados de solicitudes y revisión de recetas.' },
];

function NotificationPreferencesSkeleton() {
  const { fontScale } = useWindowDimensions();
  return (
    <Skeleton label="Cargando ajustes de notificaciones">
      <View className="gap-5 px-5 py-5">
        <View className="gap-3">
          <SkeletonBlock className="mx-3 w-2/5 rounded" style={{ height: 12 * fontScale }} />
          <SkeletonBlock className="mx-3 w-3/5 rounded" style={{ height: 14 * fontScale }} />
          <View className="overflow-hidden rounded-2xl border border-border-subtle bg-surface px-3">
            {[0, 1, 2, 3].map((row) => (
              <View
                key={row}
                className={`flex-row items-center justify-between gap-4 py-4 ${row < 3 ? 'border-b border-border-subtle' : ''}`}
              >
                <View className="flex-1 gap-1">
                  <SkeletonBlock className="w-2/5 rounded" style={{ height: 16 * fontScale }} />
                  <SkeletonBlock className="w-4/5 rounded" style={{ height: 14 * fontScale }} />
                </View>
                <SkeletonBlock className="h-[31px] w-[51px] rounded-full" />
              </View>
            ))}
          </View>
        </View>
        <View className="gap-3">
          <View className="flex-row items-center gap-2 px-3">
            <SkeletonBlock className="h-5 w-5 rounded" />
            <SkeletonBlock className="w-2/5 rounded" style={{ height: 12 * fontScale }} />
          </View>
          <View className="gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
            <SkeletonBlock className="w-full rounded" style={{ height: 14 * fontScale }} />
            <SkeletonBlock className="w-4/5 rounded" style={{ height: 14 * fontScale }} />
            <SkeletonBlock className="h-12 w-full rounded-xl" />
            <SkeletonBlock className="h-12 w-full rounded-xl" />
          </View>
        </View>
      </View>
    </Skeleton>
  );
}

export function NotificationPreferencesScreen() {
  const { user } = useAuth();
  return (
    <AccountLayout title="Ajustes de notificaciones" appearance="grouped">
      <PreferencesForm key={user?.id ?? 'guest'} />
    </AccountLayout>
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
      loadingFallback={<NotificationPreferencesSkeleton />}
      retry={() => void query.refetch()}
    >
      {preferences && (
        <View className="gap-5 px-5 py-5">
          <AccountSection
            title="Avisos de tu cuenta"
            appearance="grouped-menu"
            description="Los cambios se guardan automáticamente."
          >
            {rows.map((row, index) => (
              <View
                key={row.key}
                className={`flex-row items-center justify-between gap-4 py-4 ${index < rows.length - 1 ? 'border-b border-border-subtle' : ''}`}
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
                  disabled={
                    actions.busy ||
                    actions.isOnline === false ||
                    (row.key !== 'pushEnabled' && row.key !== 'offers' && !preferences.pushEnabled)
                  }
                  onValueChange={(value) => {
                    void change(row.key, value);
                  }}
                />
              </View>
            ))}
          </AccountSection>
          <AccountSection title="En este dispositivo" icon={Smartphone} appearance="grouped">
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
                if (!user) return;
                void actions
                  .run((isCurrent) => registerNativePush(isCurrent, true, user.id))
                  .then(() => toast.success('Los avisos están activados en este dispositivo.'))
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
          </AccountSection>
        </View>
      )}
    </AccountResourceState>
  );
}
