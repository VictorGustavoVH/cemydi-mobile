import { View } from 'react-native';
import { useRouter } from 'expo-router';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash from 'lucide-react-native/icons/trash';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { AccountSection } from '@/components/account/AccountSection';
import { useAuth } from '@/providers/auth-provider';

export function ProfileSecurityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <AccountLayout title="Seguridad de la cuenta">
      <View className="gap-7 px-5 pb-8 pt-5">
        <AccountSection title="Acceso a tu cuenta">
          <AccountMenuItem
            title="Cambiar contraseña"
            description="Actualiza tu contraseña con una verificación por correo."
            icon={ShieldCheck}
            iconTone="success"
            onPress={() => router.push('/perfil/cambiar-contrasena')}
          />
        </AccountSection>
        {user?.rol === 'CLIENT' ? (
          <View className="border-t border-border/50 pt-6">
            <AccountSection title="Cuenta y datos personales">
              <AccountMenuItem
                title="Eliminar mi cuenta"
                description="Consulta qué datos se eliminan y confirma tu solicitud por correo."
                icon={Trash}
                iconTone="textSecondary"
                onPress={() => router.push('/perfil/eliminar-cuenta')}
              />
            </AccountSection>
          </View>
        ) : null}
      </View>
    </AccountLayout>
  );
}
