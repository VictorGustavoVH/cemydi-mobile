import { Linking, Text, View } from 'react-native';
import Phone from 'lucide-react-native/icons/phone';
import Mail from 'lucide-react-native/icons/mail';
import { AppButton } from '@/components/ui/AppButton';
import { useToast } from '@/hooks/useToast';
import { colors } from '@/theme';
import { ProfileLayout } from './components/ProfileLayout';

// Same public channels published in cemydi-frontend/src/components/layout/Footer.tsx.
export const SUPPORT_CONTACTS = { phone: '7896880251', email: 'contacto@cemydi.com' } as const;
export function HelpScreen() {
  const toast = useToast();
  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(
        'No se pudo abrir una aplicación para este contacto. Puedes copiar el dato e intentarlo manualmente.',
      );
    }
  }
  return (
    <ProfileLayout title="Ayuda y contacto" publicAccess>
      <View className="gap-7 px-5 pb-8">
        <View className="gap-2">
          <Text accessibilityRole="header" className="font-sans-semibold text-xl text-primary">
            Estamos para ayudarte
          </Text>
          <Text className="font-sans text-base leading-6 text-secondary">
            Consulta tus dudas sobre productos y solicitudes de renta con CEMYDI.
          </Text>
        </View>
        <View className="gap-3">
          <Text selectable className="font-sans text-base text-primary">
            {SUPPORT_CONTACTS.phone}
          </Text>
          <AppButton
            label="Llamar a CEMYDI"
            variant="secondary"
            onPress={() => void open(`tel:${SUPPORT_CONTACTS.phone}`)}
            leftIcon={<Phone aria-hidden color={colors.brandStrong} size={20} />}
          />
          <Text selectable className="font-sans text-base text-primary">
            {SUPPORT_CONTACTS.email}
          </Text>
          <AppButton
            label="Escribir a CEMYDI"
            variant="secondary"
            onPress={() => void open(`mailto:${SUPPORT_CONTACTS.email}`)}
            leftIcon={<Mail aria-hidden color={colors.brandStrong} size={20} />}
          />
        </View>
        <View className="gap-4">
          <Text accessibilityRole="header" className="font-sans-semibold text-lg text-primary">
            Preguntas frecuentes
          </Text>
          <View className="gap-2">
            <Text className="font-sans-semibold text-base text-primary">
              ¿Dónde consulto mis rentas?
            </Text>
            <Text className="font-sans text-base leading-6 text-secondary">
              En Perfil, abre Mis rentas para consultar el estado y detalle de las solicitudes de tu
              cuenta.
            </Text>
          </View>
          <View className="gap-2">
            <Text className="font-sans-semibold text-base text-primary">
              ¿Cómo cambio mis datos?
            </Text>
            <Text className="font-sans text-base leading-6 text-secondary">
              Abre Datos personales, edita tu información y pulsa Guardar cambios. El correo
              guardado se utiliza para iniciar sesión.
            </Text>
          </View>
          <View className="gap-2">
            <Text className="font-sans-semibold text-base text-primary">
              ¿Olvidaste tu contraseña?
            </Text>
            <Text className="font-sans text-base leading-6 text-secondary">
              En la pantalla de inicio de sesión, selecciona Olvidé mi contraseña para recuperar el
              acceso con un código enviado a tu correo.
            </Text>
          </View>
        </View>
      </View>
    </ProfileLayout>
  );
}
