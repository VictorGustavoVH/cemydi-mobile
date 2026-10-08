import { useRouter, type Href } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

export type BackButtonProps = {
  /** Acción personalizada al presionar. Si no se provee, utiliza la navegación de Expo Router */
  onPress?: () => void;
  /** Ruta a la que navegar si no hay historial previo en el stack */
  fallbackHref?: Href;
  /** Etiqueta accesible para lectores de pantalla (por defecto 'Volver') */
  label?: string;
  /** Etiqueta de accesibilidad explícita */
  accessibilityLabel?: string;
  /** Clases utilitarias adicionales de Tailwind / NativeWind */
  className?: string;
  /** Tamaño del icono en píxeles (por defecto 24) */
  iconSize?: number;
  /** Color del icono (por defecto colors.textPrimary) */
  iconColor?: string;
  /** Deshabilita el botón */
  disabled?: boolean;
  /** Identificador para pruebas */
  testID?: string;
};

export function BackButton({
  onPress,
  fallbackHref,
  label = 'Volver',
  accessibilityLabel,
  className = '',
  iconSize = 24,
  iconColor = colors.textPrimary,
  disabled = false,
  testID,
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else if (fallbackHref) {
      router.replace(fallbackHref);
    } else {
      router.back();
    }
  };

  return (
    <AppButton
      accessibilityLabel={accessibilityLabel ?? label}
      className={`h-11 w-11 rounded-full px-0 py-0 ${className}`.trim()}
      disabled={disabled}
      hideLabel
      label={label}
      leftIcon={<ArrowLeft aria-hidden color={iconColor} size={iconSize} />}
      onPress={handlePress}
      testID={testID}
      variant="ghost"
    />
  );
}

export const AppBackButton = BackButton;
