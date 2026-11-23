import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import { useCallback, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import Settings from 'lucide-react-native/icons/settings';
import BadgeCheck from 'lucide-react-native/icons/badge-check';
import UserRound from 'lucide-react-native/icons/user-round';
import MapPin from 'lucide-react-native/icons/map-pin';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import Search from 'lucide-react-native/icons/search';
import LogOut from 'lucide-react-native/icons/log-out';
import Heart from 'lucide-react-native/icons/heart';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Bell from 'lucide-react-native/icons/bell';
import MessageSquare from 'lucide-react-native/icons/message-square';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import FileText from 'lucide-react-native/icons/file-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppSheet } from '@/components/ui/AppSheet';
import { useAuth } from '@/providers/auth-provider';
import { useAuthAction } from '@/features/auth';
import { useToast } from '@/hooks/useToast';
import { useFavorites } from '@/features/favorites';
import { colors } from '@/theme';
import { AccountLayout } from '@/components/account/AccountLayout';
import { ProfileDataState } from './components/ProfileDataState';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { useProfile } from './useProfile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export function ProfileScreen() {
  const router = useSafeNavigation();
  const profile = useProfile();
  const refreshEnabled = profile.status === 'authenticated' && profile.isOnline !== false;
  const { refreshing, onRefresh } = usePullToRefresh(profile.query.refetch, {
    enabled: refreshEnabled,
  });
  const favorites = useFavorites();
  const user = profile.query.data ?? profile.user;
  const { logoutDetailed } = useAuth();
  const toast = useToast();
  const { execute, pending } = useAuthAction();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [dialogAnim] = useState(() => new Animated.Value(0));

  const openLogoutDialog = () => {
    dialogAnim.setValue(0);
    setConfirmLogout(true);
    Animated.timing(dialogAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const edit = useCallback(() => router.navigate('/perfil/editar'), [router]);
  const security = useCallback(() => router.navigate('/perfil/seguridad'), [router]);

  const initials =
    user?.nombre
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toLocaleUpperCase('es-MX') || 'CM';

  const isProfileIncomplete =
    !profile.query.isLoading &&
    Boolean(profile.query.data) &&
    (!profile.query.data?.telefono?.trim() || !profile.query.data?.direccion?.trim());

  return (
    <AccountLayout
      title="Mi perfil"
      main
      refreshing={refreshing}
      onRefresh={onRefresh}
      refreshEnabled={refreshEnabled}
      action={
        <AppButton
          label="Abrir configuración"
          hideLabel
          variant="ghost"
          className="h-11 w-11 px-0 py-0"
          onPress={() => router.navigate('/perfil/configuracion')}
          leftIcon={<Settings aria-hidden size={22} color={colors.iconOnSurface} />}
        />
      }
    >
      <View className="flex-1 bg-surface-muted">
        <View className="px-5 pb-2 pt-7">
          <View className="items-center gap-4">
            <View
              accessible={false}
              className="h-20 w-20 items-center justify-center rounded-full bg-brand-muted"
            >
              <Text className="font-sans-bold text-2xl text-brand-strong">{initials}</Text>
            </View>
            <View className="w-full min-w-0 gap-1">
              <Text
                accessibilityRole="header"
                className="text-center font-sans-bold text-2xl text-primary"
              >
                {user?.nombre}
              </Text>
              <Text selectable className="text-center font-sans text-sm leading-5 text-secondary">
                {user?.correo}
              </Text>
            </View>
          </View>

          {isProfileIncomplete ? (
            <View className="mt-5 items-center gap-2">
              <View className="gap-1">
                <Text className="text-center font-sans-semibold text-sm text-primary">
                  Completa tu perfil
                </Text>
                <Text className="text-center font-sans text-sm leading-5 text-secondary">
                  Agrega tu teléfono y dirección para agilizar tus solicitudes.
                </Text>
              </View>
              <AppButton label="Completar" variant="ghost" onPress={edit} />
            </View>
          ) : null}
        </View>

        <ProfileDataState profile={profile} fallbackToSession>
          <View className="gap-6 px-5 py-6">
            {/* Sección 1: Cuenta (con indicador de Correo verificado en el encabezado) */}
            <View>
              <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2 px-3">
                <Text
                  accessibilityRole="header"
                  className="font-sans-bold text-xs uppercase tracking-widest text-secondary"
                >
                  Tu información
                </Text>
                {user?.emailVerified ? (
                  <View className="flex-row items-center gap-1.5">
                    <BadgeCheck aria-hidden color={colors.brandStrong} size={15} />
                    <Text className="font-sans-medium text-xs text-brand-strong">
                      Correo verificado
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="overflow-hidden rounded-2xl border border-border-subtle bg-surface px-3">
                <AccountMenuItem
                  appearance="inset"
                  title="Datos personales"
                  description="Nombre, correo y teléfono"
                  icon={UserRound}
                  iconTone="brandStrong"
                  onPress={edit}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Dirección de contacto"
                  description="Consulta y actualiza tu dirección de contacto"
                  icon={MapPin}
                  iconTone="brandStrong"
                  onPress={edit}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Seguridad de la cuenta"
                  description="Administra tu contraseña y tu cuenta"
                  icon={ShieldCheck}
                  iconTone="success"
                  onPress={security}
                  last
                />
              </View>
            </View>

            {/* Sección 2: Actividad y catálogo */}
            <View>
              <View className="mb-3 flex-row items-center justify-between px-3">
                <Text
                  accessibilityRole="header"
                  className="font-sans-bold text-xs uppercase tracking-widest text-secondary"
                >
                  Tus productos
                </Text>
              </View>
              <View className="overflow-hidden rounded-2xl border border-border-subtle bg-surface px-3">
                <AccountMenuItem
                  appearance="inset"
                  title="Mis rentas"
                  description="Estado, detalle y seguimiento de solicitudes"
                  icon={CalendarDays}
                  iconTone="brandStrong"
                  onPress={() => router.navigate('/perfil/rentas')}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Notificaciones"
                  description="Avisos de tu cuenta y ofertas"
                  icon={Bell}
                  iconTone="accentOrange"
                  onPress={() => router.navigate('/perfil/notificaciones')}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Mis favoritos"
                  description={
                    favorites.total > 0
                      ? `${favorites.total} producto${favorites.total === 1 ? '' : 's'} guardado${favorites.total === 1 ? '' : 's'}`
                      : 'Tus productos guardados'
                  }
                  icon={Heart}
                  iconTone="accentRose"
                  onPress={() => router.navigate('/favoritos')}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Mi carrito"
                  description="Productos guardados en tu cuenta"
                  icon={ShoppingBag}
                  iconTone="info"
                  onPress={() => router.navigate('/carrito')}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Mis reseñas"
                  description="Tus opiniones y su estado de revisión"
                  icon={MessageSquare}
                  iconTone="accentIndigo"
                  onPress={() => router.navigate('/perfil/resenas')}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Explorar catálogo"
                  description="Equipos para tu bienestar"
                  icon={Search}
                  iconTone="brandStrong"
                  onPress={() => router.navigate('/catalogo')}
                  last
                />
              </View>
            </View>

            {/* Sección 3: Soporte y legales */}
            <View>
              <View className="mb-3 flex-row items-center justify-between px-3">
                <Text
                  accessibilityRole="header"
                  className="font-sans-bold text-xs uppercase tracking-widest text-secondary"
                >
                  Ayuda e información
                </Text>
              </View>
              <View className="overflow-hidden rounded-2xl border border-border-subtle bg-surface px-3">
                <AccountMenuItem
                  appearance="inset"
                  title="Ayuda y contacto"
                  description="Preguntas frecuentes y atención CEMYDI"
                  icon={CircleHelp}
                  iconTone="info"
                  onPress={() => router.navigate('/perfil/ayuda')}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Política de privacidad"
                  description="Consulta el tratamiento de tus datos"
                  icon={ShieldCheck}
                  iconTone="textSecondary"
                  onPress={() => router.navigate('/perfil/legal/politicas-de-privacidad')}
                />
                <AccountMenuItem
                  appearance="inset"
                  title="Términos y condiciones"
                  description="Información publicada por CEMYDI"
                  icon={FileText}
                  iconTone="textSecondary"
                  onPress={() => router.navigate('/perfil/legal/terminos-y-condiciones')}
                  last
                />
              </View>
            </View>
          </View>
        </ProfileDataState>

        <View className="px-5 pb-10">
          <AppButton
            label="Cerrar sesión"
            variant="unstyled"
            className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 py-4 active:bg-surface-muted"
            disabled={pending}
            loading={pending}
            onPress={openLogoutDialog}
            leftIcon={<LogOut aria-hidden color={colors.danger} size={20} />}
          >
            <Text className="font-sans-semibold text-base text-danger">Cerrar sesión</Text>
          </AppButton>
        </View>
      </View>

      <AppSheet
        visible={confirmLogout}
        presentation="dialog"
        title="¿Cerrar sesión?"
        closeDisabled={pending}
        onClose={() => {
          if (!pending) setConfirmLogout(false);
        }}
      >
        <Animated.View
          className="gap-4"
          style={{
            opacity: dialogAnim,
            transform: [
              {
                translateY: dialogAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
        >
          <Text className="font-sans text-sm leading-5 text-secondary">
            Tus productos guardados y el historial de tu cuenta estarán disponibles cuando vuelvas a
            ingresar.
          </Text>

          <View className="flex-row items-center gap-2.5 pt-4">
            <View className="flex-1">
              <AppButton
                label="Cancelar"
                variant="secondary"
                disabled={pending}
                onPress={() => setConfirmLogout(false)}
              />
            </View>
            <View className="flex-1">
              <AppButton
                label="Salir"
                variant="destructive"
                loading={pending}
                onPress={() => {
                  let remoteStatus: 'revoked' | 'pending' | 'failed' = 'revoked';
                  let pushStatus: 'cleared' | 'pending' | 'failed' | undefined;
                  void execute(
                    async () => {
                      const result = await logoutDetailed();
                      remoteStatus = result.remoteStatus;
                      pushStatus = result.pushStatus;
                    },
                    'Sesión cerrada en este dispositivo',
                    () => {
                      setConfirmLogout(false);
                      router.navigate('/inicio');
                      if (remoteStatus === 'failed')
                        toast.info('No pudimos revocar la sesión en el servidor.');
                      if (remoteStatus === 'pending')
                        toast.info('La revocación en el servidor sigue pendiente.');
                      if (remoteStatus === 'revoked' && pushStatus === 'failed')
                        toast.info('No pudimos borrar el registro local de notificaciones.');
                    },
                  );
                }}
              />
            </View>
          </View>
        </Animated.View>
      </AppSheet>
    </AccountLayout>
  );
}
