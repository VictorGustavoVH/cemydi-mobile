import { Text } from 'react-native';
import { AppSheet } from './AppSheet';
import { AppButton } from './AppButton';
import { useAuth } from '@/providers/auth-provider';
import { useAuthAction } from '@/features/auth/hooks/useAuthAction';

type ProfileSheetProps = {
  visible: boolean;
  onClose: () => void;
  user: { nombre: string; correo: string } | null | undefined;
};

export function ProfileSheet({ visible, onClose, user }: ProfileSheetProps) {
  const { logout } = useAuth();
  const { execute, pending } = useAuthAction();
  return (
    <AppSheet visible={visible} onClose={onClose} title="Tu perfil">
      <Text className="font-sans text-base leading-6 text-secondary">
        {user?.nombre}
        {'\n'}
        {user?.correo}
      </Text>
      <AppButton
        label="Cerrar sesión"
        variant="secondary"
        loading={pending}
        onPress={() => void execute(logout, 'Sesión cerrada correctamente', onClose)}
      />
    </AppSheet>
  );
}
