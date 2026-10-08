import { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppScreen } from '@/components/ui/AppScreen';
import { AppSheet } from '@/components/ui/AppSheet';
import { useToast } from '@/hooks/useToast';

const examples = [
  ['Inicio de sesión', 'Iniciando sesión...', 'Sesión iniciada', 'No se pudo iniciar sesión'],
  ['Registro', 'Creando cuenta...', 'Cuenta creada', 'No se pudo crear la cuenta'],
  ['Envío de receta', 'Enviando receta...', 'Receta enviada', 'No se pudo enviar la receta'],
  ['Envío de correo', 'Enviando correo...', 'Correo enviado', 'No se pudo enviar el correo'],
  [
    'Agregar al carrito',
    'Agregando producto...',
    'Producto agregado',
    'No se pudo agregar el producto',
  ],
] as const;

export function ToastDemoScreen() {
  const toast = useToast();
  const [fail, setFail] = useState(false);
  const [failUndo, setFailUndo] = useState(false);
  const [sheet, setSheet] = useState(false);
  const pending = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const owned = useRef(new Set<number>());
  useEffect(() => {
    const timers = pending.current;
    const ids = owned.current;
    return () => {
      timers.forEach((reject, timer) => {
        clearTimeout(timer);
        reject();
      });
      timers.clear();
      ids.forEach((id) => toast.dismiss(id));
    };
  }, [toast]);
  // Delays exist only in this explicitly simulated demo, never in the toast API.
  const simulate = (shouldFail = false) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.current.delete(timer);
        if (shouldFail) reject(new Error('Fallo simulado'));
        else resolve();
      }, 1400);
      pending.current.set(timer, () => reject(new Error('Demo desmontada')));
    });
  const run = async (
    loading: string,
    message: string,
    error: string,
    type: 'success' | 'info' = 'success',
  ) => {
    const id = toast.loading(loading);
    owned.current.add(id);
    try {
      await simulate(fail);
      toast.update(id, { type, message });
    } catch {
      toast.update(id, { type: 'error', message: error });
    }
  };
  const remove = async () => {
    const id = toast.loading('Eliminando producto...');
    owned.current.add(id);
    try {
      await simulate(fail);
      toast.update(id, {
        type: 'undo',
        message: 'Producto eliminado',
        duration: 6000,
        onUndo: () => simulate(failUndo),
        errorMessage: 'No se pudo restaurar el producto',
      });
    } catch {
      toast.update(id, { type: 'error', message: 'No se pudo eliminar el producto' });
    }
  };
  return (
    <AppScreen scroll contentClassName="gap-3 p-5">
      <Text className="font-sans-bold text-xl text-primary">Toast CEMYDI</Text>
      <Text className="font-sans text-sm text-secondary">
        Demostración temporal con operaciones simuladas. No inicia sesión ni envía datos. Puedes
        repetir pulsaciones o salir durante una operación.
      </Text>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 font-sans text-primary">Simular error de operación</Text>
        <Switch
          accessibilityLabel="Simular error de operación"
          value={fail}
          onValueChange={setFail}
        />
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 font-sans text-primary">Simular error al deshacer</Text>
        <Switch
          accessibilityLabel="Simular error al deshacer"
          value={failUndo}
          onValueChange={setFailUndo}
        />
      </View>
      {examples.map(([label, loading, success, error]) => (
        <AppButton
          key={label}
          label={label}
          variant="outline"
          onPress={() => {
            void run(loading, success, error);
          }}
        />
      ))}
      <AppButton
        label="Eliminar producto del carrito"
        onPress={() => {
          void remove();
        }}
      />
      <AppButton
        label="Mostrar información"
        variant="outline"
        onPress={() => {
          void run(
            'Consultando...',
            'Información actualizada',
            'No se pudo actualizar la información',
            'info',
          );
        }}
      />
      <AppButton
        label="Mostrar error"
        variant="outline"
        onPress={() => {
          const id = toast.error('No se pudo enviar la receta');
          owned.current.add(id);
        }}
      />
      <AppButton label="Probar dentro de un modal" variant="ghost" onPress={() => setSheet(true)} />
      <AppSheet title="Toast dentro del modal" visible={sheet} onClose={() => setSheet(false)}>
        <AppButton
          label="Mostrar información"
          onPress={() => {
            const id = toast.info('Información actualizada');
            owned.current.add(id);
          }}
        />
      </AppSheet>
    </AppScreen>
  );
}
