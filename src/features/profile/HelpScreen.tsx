import { Linking, Text, View } from 'react-native';
import Phone from 'lucide-react-native/icons/phone';
import Mail from 'lucide-react-native/icons/mail';
import MapPin from 'lucide-react-native/icons/map-pin';
import Navigation from 'lucide-react-native/icons/navigation';
import { AppButton } from '@/components/ui/AppButton';
import { AccountSection } from '@/components/account/AccountSection';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors } from '@/theme';
import { FacebookIcon, WhatsAppIcon } from './components/SocialBrandIcon';
import { SUPPORT_CONTACTS, SUPPORT_LOCATIONS } from './support-content';
import { useToast } from '@/hooks/useToast';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { FrequentlyAskedQuestions } from '@/components/support/FrequentlyAskedQuestions';
import { AccountLayout } from '@/components/account/AccountLayout';

export function HelpScreen() {
  const toast = useToast();
  const { isOnline } = useNetworkStatus();
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
    <AccountLayout title="Ayuda y contacto" publicAccess>
      <View className="gap-7 px-5 pb-8 pt-5">
        <View className="gap-3">
          <Text
            accessibilityRole="header"
            className="font-sans-semibold text-2xl leading-8 text-primary"
          >
            ¿En qué podemos ayudarte?
          </Text>
          <Text className="font-sans text-sm leading-6 text-secondary">
            Habla con nuestro equipo o visítanos en Huejutla.
          </Text>
        </View>
        <AccountSection title="Atención al cliente">
          <AccountMenuItem
            title="Escribir por WhatsApp"
            description="Consulta productos y rentas"
            icon={WhatsAppIcon}
            iconTone="brandStrong"
            appearance="divided"
            disabled={isOnline === false}
            onPress={() => void open(SUPPORT_CONTACTS.whatsapp)}
          />
          <AccountMenuItem
            title="Llamar a CEMYDI"
            description={SUPPORT_CONTACTS.displayPhone}
            selectableDescription
            appearance="divided"
            iconTone="textSecondary"
            icon={Phone}
            onPress={() => void open(`tel:${SUPPORT_CONTACTS.phone}`)}
          />
          <AccountMenuItem
            title="Escribir a CEMYDI"
            description={SUPPORT_CONTACTS.email}
            selectableDescription
            appearance="divided"
            iconTone="textSecondary"
            icon={Mail}
            onPress={() => void open(`mailto:${SUPPORT_CONTACTS.email}`)}
          />
        </AccountSection>
        <View className="border-t border-border/50 pt-6">
          <AccountSection title="Redes sociales">
            <AccountMenuItem
              title="Facebook de CEMYDI"
              description="Ortopedia CEMYDI"
              icon={FacebookIcon}
              iconTone="textSecondary"
              disabled={isOnline === false}
              onPress={() => void open(SUPPORT_CONTACTS.facebook)}
            />
          </AccountSection>
        </View>
        <View className="border-t border-border/50 pt-6">
          <AccountSection title="Nuestras ubicaciones" description={SUPPORT_LOCATIONS[0].hours}>
            {SUPPORT_LOCATIONS.map((location) => (
              <View key={location.name} className="flex-row gap-3 border-b border-border/50 py-5">
                <MapPin aria-hidden size={22} color={colors.brandStrong} />
                <View className="min-w-0 flex-1 gap-3">
                  <View className="gap-2">
                    <Text
                      accessibilityRole="header"
                      className="font-sans-semibold text-lg text-primary"
                    >
                      {location.name}
                    </Text>
                    <Text selectable className="font-sans text-sm leading-6 text-secondary">
                      {location.address}
                    </Text>
                  </View>
                  <AppButton
                    label="Cómo llegar"
                    accessibilityLabel={`Cómo llegar a ${location.name}`}
                    accessibilityRole="link"
                    variant="ghost"
                    className="self-start"
                    disabled={isOnline === false}
                    onPress={() => void open(location.mapUrl)}
                    leftIcon={<Navigation aria-hidden size={18} color={colors.brandStrong} />}
                  />
                </View>
              </View>
            ))}
            <Text className="font-sans text-sm leading-5 text-secondary">
              Confirma por teléfono el horario antes de visitarnos en días festivos.
            </Text>
          </AccountSection>
        </View>
        {isOnline === false ? (
          <Text
            accessibilityLiveRegion="polite"
            className="font-sans text-sm leading-6 text-secondary"
          >
            Sin conexión. Las direcciones y teléfonos siguen disponibles; conéctate para abrir
            WhatsApp, Facebook o los mapas.
          </Text>
        ) : null}
        <FrequentlyAskedQuestions />
      </View>
    </AccountLayout>
  );
}
