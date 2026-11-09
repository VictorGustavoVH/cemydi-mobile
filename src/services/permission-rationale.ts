import { Alert } from 'react-native';

const explanations = {
  microphone: {
    title: 'Buscar con tu voz',
    message:
      'CEMYDI necesita el micrófono y el reconocimiento de voz para convertir lo que digas en una búsqueda. El servicio de voz del dispositivo puede procesar el audio. No guardamos grabaciones en la app. Puedes continuar buscando por escrito si no aceptas.',
  },
  notifications: {
    title: 'Recibir avisos de CEMYDI',
    message:
      'Permite las notificaciones para recibir avisos de tus rentas, seguridad y las ofertas que actives. Puedes cambiar tus preferencias o desactivar este permiso en los ajustes del teléfono. Tu bandeja seguirá disponible sin este permiso.',
  },
} as const;

export function explainPermission(kind: keyof typeof explanations): Promise<boolean> {
  const { title, message } = explanations[kind];
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
