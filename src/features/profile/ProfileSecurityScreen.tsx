import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import { View } from 'react-native';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash from 'lucide-react-native/icons/trash';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { AccountSection } from '@/components/account/AccountSection';
import { useAuth } from '@/providers/auth-provider';

export function ProfileSecurityScreen() {
  const router = useSafeNavigation();
  const { user } = useAuth();
  return (
    <AccountLayout title="Seguridad de la cuenta" appearance="grouped">
      <View className="gap-6 px-5 pb-8 pt-6">
        <AccountSection title="Acceso a tu cuenta" appearance="grouped-menu">
          <AccountMenuItem
            title="Cambiar contraseña"
            description="Actualiza tu contraseña con una verificación por correo."
            icon={ShieldCheck}
            iconTone="success"
            onPress={() => router.navigate('/perfil/cambiar-contrasena')}
          />
        </AccountSection>
        {user?.rol === 'CLIENT' ? (
          <AccountSection title="Cuenta y datos personales" appearance="grouped-menu">
            <AccountMenuItem
              title="Eliminar mi cuenta"
              description="Consulta qué datos se eliminan y confirma tu solicitud por correo."
              icon={Trash}
              iconTone="textSecondary"
              onPress={() => router.navigate('/perfil/eliminar-cuenta')}
            />
          </AccountSection>
        ) : null}
      </View>
    </AccountLayout>
  );
}
