import { Linking, Text, View } from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import Mic from 'lucide-react-native/icons/mic';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import { useToast } from '@/hooks/useToast';

export function SettingsScreen() {
  const router = useSafeNavigation();
  const toast = useToast();
  return (
    <AccountLayout title="Configuración" appearance="grouped">
      <View className="gap-6 px-5 pb-8 pt-6">
        <Text className="font-sans text-sm leading-6 text-secondary">
          Personaliza tus avisos y los permisos de CEMYDI.
        </Text>
        <AccountSection title="Preferencias de la app" appearance="grouped-menu">
          <AccountMenuItem
            title="Notificaciones"
            description="Elige qué avisos quieres recibir"
            icon={Bell}
            iconTone="accentOrange"
            appearance="inset"
            onPress={() => router.navigate('/perfil/notificaciones/preferencias')}
          />
          <AccountMenuItem
            title="Micrófono"
            description="Configura el permiso para buscar con tu voz en los ajustes del teléfono"
            icon={Mic}
            iconTone="brandStrong"
            last
            onPress={() => {
              void Linking.openSettings().catch(() =>
                toast.error('No pudimos abrir los ajustes del teléfono. Intenta de nuevo.'),
              );
            }}
          />
        </AccountSection>
      </View>
    </AccountLayout>
  );
}
