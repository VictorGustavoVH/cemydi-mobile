import { View } from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import UserRound from 'lucide-react-native/icons/user-round';
import { AppButton } from '@/components/ui/AppButton';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { colors } from '@/theme';

const logoSource = require('../../../../assets/branding/cemydi-logo-horizontal.png');

type HomeHeaderProps = { onNotifications: () => void; onProfile: () => void };
export function HomeHeader({ onNotifications, onProfile }: HomeHeaderProps) {
  return (
    <View className="flex-row items-center justify-between gap-3 px-5 pb-4 pt-3">
      <View className="flex-1 justify-center">
        <CatalogImage
          label="Ortopedia CEMYDI"
          compact
          source={logoSource}
          style={{ height: 36, width: 124 }}
        />
      </View>
      <View className="flex-row gap-2">
        <AppButton
          className="h-11 w-11 px-0 py-0"
          hideLabel
          label="Notificaciones"
          onPress={onNotifications}
          variant="secondary"
          leftIcon={<Bell aria-hidden color={colors.textPrimary} size={21} />}
        />
        <AppButton
          className="h-11 w-11 items-center justify-center rounded-xl bg-brand/10 px-0 py-0"
          hideLabel
          label="Perfil"
          onPress={onProfile}
          variant="unstyled"
          leftIcon={<UserRound aria-hidden color={colors.brandStrong} size={21} />}
        />
      </View>
    </View>
  );
}
