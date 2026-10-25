import { useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { AppSheet } from '@/components/ui/AppSheet';
import { AppButton } from '@/components/ui/AppButton';
import { useToast } from '@/hooks/useToast';

type UnsavedProfileChangesProps = { dirty: boolean; saving: boolean };
export function UnsavedProfileChanges({ dirty, saving }: UnsavedProfileChangesProps) {
  const navigation = useNavigation();
  const toast = useToast();
  const [action, setAction] = useState<NavigationAction | null>(null);
  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) toast.info('Espera a que termine el guardado.');
    else setAction(data.action);
  });
  return (
    <AppSheet title="¿Salir sin guardar?" visible={action !== null} onClose={() => setAction(null)}>
      <Text className="font-sans text-base leading-6 text-secondary">
        Tienes cambios pendientes. Si sales, se descartarán.
      </Text>
      <AppButton label="Seguir editando" onPress={() => setAction(null)} />
      <AppButton
        label="Descartar cambios"
        variant="ghost"
        onPress={() => {
          if (!action) return;
          const next = action;
          setAction(null);
          navigation.dispatch(next);
        }}
      />
    </AppSheet>
  );
}
