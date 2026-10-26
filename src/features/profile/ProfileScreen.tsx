import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { env, parseWebsiteUrl } from '@/config/env';
import { AppButton } from '@/components/ui/AppButton';
import { AppSheet } from '@/components/ui/AppSheet';
import { useAuth } from '@/providers/auth-provider';
import { useAuthAction } from '@/features/auth/hooks/useAuthAction';
import { useToast } from '@/hooks/useToast';
import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { useRouteCallback } from '@/hooks/useRouteCallback';
import { colors } from '@/theme';
import { ProfileLayout } from './components/ProfileLayout';
import { ProfileDataState } from './components/ProfileDataState';
import { ProfileMenuItem } from './components/ProfileMenuItem';
import { useProfile } from './useProfile';

export function ProfileScreen() {
  const router = useRouter();
  const profile = useProfile();
  const favorites = useFavorites();
  const user = profile.query.data ?? profile.user;
  const { logoutDetailed } = useAuth();
  const toast = useToast();
  const { execute, pending } = useAuthAction();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const edit = useRouteCallback(
    () => router.push('/perfil/editar'),
    () => '/perfil/editar',
  );
  const security = useRouteCallback(
    () => router.push('/perfil/seguridad'),
    () => '/perfil/seguridad',
  );
  async function openLegal(path: string) {
    try {
      const origin = parseWebsiteUrl(process.env.EXPO_PUBLIC_WEBSITE_URL, env.appEnv);
      if (!origin) {
        toast.error('No se pudo abrir la página. Intenta más tarde.');
        return;
      }
      await Linking.openURL(new URL(path, origin).toString());
    } catch {
      toast.error('No se pudo abrir la página. Intenta más tarde.');
    }
  }
  const initials =
    user?.nombre
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toLocaleUpperCase('es-MX') || 'CM';
  return (
    <ProfileLayout
      title="Mi perfil"
      main
      action={
        <AppButton
          label="Editar perfil"
          hideLabel
          variant="ghost"
          className="h-11 w-11 px-0 py-0"
          onPress={edit}
          leftIcon={<Settings aria-hidden size={22} color={colors.brandStrong} />}
        />
      }
    >
      <View className="mx-5 mb-6 gap-5 py-5">
        <View className="flex-row items-center gap-4">
          <View
            accessible={false}
            className="h-20 w-20 items-center justify-center rounded-full bg-brand/10"
          >
            <Text className="font-sans-bold text-2xl text-brand-strong">{initials}</Text>
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-sans-semibold text-xs uppercase tracking-widest text-brand-strong">
              Cuenta CEMYDI
            </Text>
            <Text accessibilityRole="header" className="font-sans-bold text-xl text-primary">
              {user?.nombre}
            </Text>
            <Text selectable className="font-sans text-sm leading-5 text-secondary">
              {user?.correo}
            </Text>
          </View>
        </View>
        {user?.emailVerified ? (
          <View className="flex-row items-center gap-2">
            <BadgeCheck aria-hidden color={colors.brandStrong} size={18} />
            <Text className="flex-1 font-sans-medium text-sm text-brand-strong">
              Correo verificado
            </Text>
          </View>
        ) : null}
        {!profile.query.isLoading &&
        profile.query.data &&
        (!profile.query.data.telefono?.trim() || !profile.query.data.direccion?.trim()) ? (
          <View className="flex-row items-center justify-between gap-3 py-2">
            <View className="flex-1 pr-3">
              <Text className="font-sans-semibold text-xs text-brand-strong">
                Completa tu perfil
              </Text>
              <Text className="font-sans text-[11px] leading-4 text-secondary">
                Agrega tu teléfono y dirección para agilizar tus solicitudes.
              </Text>
            </View>
            <AppButton label="Completar" variant="ghost" onPress={edit} />
          </View>
        ) : null}
      </View>
      <ProfileDataState profile={profile}>
        <View className="gap-6 px-5 pb-6">
          <View className="gap-3">
            <Text
              accessibilityRole="header"
              className="font-sans-semibold text-sm uppercase tracking-wider text-secondary"
            >
              Tu información
            </Text>
            <View>
              <ProfileMenuItem
                title="Datos personales"
                description="Nombre, correo y teléfono"
                icon={UserRound}
                onPress={edit}
              />
              <ProfileMenuItem
                title="Dirección de contacto"
                description={profile.query.data?.direccion || 'Agrega tu dirección'}
                icon={MapPin}
                onPress={edit}
              />
              <ProfileMenuItem
                title="Contraseña y acceso"
                description="Cambia tu contraseña"
                icon={ShieldCheck}
                onPress={security}
                last
              />
            </View>
          </View>
          <View className="gap-3">
            <Text
              accessibilityRole="header"
              className="font-sans-semibold text-sm uppercase tracking-wider text-secondary"
            >
              Tus productos
            </Text>
            <View>
              <ProfileMenuItem
                title="Mis rentas"
                description="Estado, detalle y seguimiento de solicitudes"
                icon={CalendarDays}
                onPress={() => router.push('/perfil/rentas')}
              />
              <ProfileMenuItem
                title="Notificaciones"
                description="Avisos, ofertas y preferencias sincronizadas"
                icon={Bell}
                onPress={() => router.push('/perfil/notificaciones')}
              />
              <ProfileMenuItem
                title="Mis favoritos"
                description={
                  favorites.total > 0
                    ? `${favorites.total} producto${favorites.total === 1 ? '' : 's'} guardado${favorites.total === 1 ? '' : 's'}`
                    : 'Tus productos guardados'
                }
                icon={Heart}
                onPress={() => router.push('/favoritos')}
              />
              <ProfileMenuItem
                title="Mi carrito"
                description="Productos guardados en tu cuenta"
                icon={ShoppingBag}
                onPress={() => router.navigate('/carrito')}
              />
              <ProfileMenuItem
                title="Mis reseñas"
                description="Tus opiniones y su estado de revisión"
                icon={MessageSquare}
                onPress={() => router.push('/perfil/resenas')}
              />
              <ProfileMenuItem
                title="Explorar catálogo"
                description="Equipos para tu bienestar"
                icon={Search}
                onPress={() => router.navigate('/catalogo')}
                last
              />
            </View>
          </View>
          <View className="gap-3">
            <Text
              accessibilityRole="header"
              className="font-sans-semibold text-sm uppercase tracking-wider text-secondary"
            >
              Ayuda e información
            </Text>
            <View>
              <ProfileMenuItem
                title="Ayuda y contacto"
                description="Preguntas frecuentes y atención CEMYDI"
                icon={CircleHelp}
                onPress={() => router.push('/perfil/ayuda')}
              />
              <ProfileMenuItem
                title="Política de privacidad"
                description="Consulta el tratamiento de tus datos"
                icon={ShieldCheck}
                onPress={() => void openLegal('/politicas-de-privacidad')}
              />
              <ProfileMenuItem
                title="Términos y condiciones"
                description="Información publicada por CEMYDI"
                icon={FileText}
                onPress={() => void openLegal('/terminos-y-condiciones')}
              />
            </View>
          </View>
        </View>
      </ProfileDataState>
      <View className="px-5 pb-8">
        <AppButton
          label="Cerrar sesión"
          variant="secondary"
          disabled={pending}
          onPress={() => setConfirmLogout(true)}
          leftIcon={<LogOut aria-hidden color={colors.textSecondary} size={20} />}
        />
      </View>
      <AppSheet
        visible={confirmLogout}
        title="¿Cerrar sesión?"
        onClose={() => {
          if (!pending) setConfirmLogout(false);
        }}
      >
        <Text className="font-sans text-base leading-6 text-secondary">
          Tu carrito y tus datos guardados seguirán en tu cuenta cuando vuelvas.
        </Text>
        <AppButton
          label="Confirmar cierre de sesión"
          variant="destructive"
          loading={pending}
          onPress={() => {
            let remoteStatus: 'revoked' | 'pending' | 'failed' = 'revoked';
            void execute(
              async () => {
                remoteStatus = (await logoutDetailed()).remoteStatus;
              },
              'Sesión cerrada en este dispositivo',
              () => {
                setConfirmLogout(false);
                router.navigate('/inicio');
                if (remoteStatus === 'failed')
                  toast.info('No pudimos revocar la sesión en el servidor.');
                if (remoteStatus === 'pending')
                  toast.info('La revocación en el servidor sigue pendiente.');
              },
            );
          }}
        />
        <AppButton
          label="Seguir en mi cuenta"
          variant="ghost"
          disabled={pending}
          onPress={() => setConfirmLogout(false)}
        />
      </AppSheet>
    </ProfileLayout>
  );
}
