import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isDevice } from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { UserFacingError } from '@/services/http/api-error';
import { notificationService } from './notification-service';

export async function loadNativeNotifications() {
  if (
    Platform.OS === 'web' ||
    !isDevice ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    throw new UserFacingError(
      'Las notificaciones push necesitan la app instalada en un dispositivo físico.',
    );
  }
  try {
    return await import('expo-notifications');
  } catch {
    throw new UserFacingError(
      'Actualiza la app para activar las notificaciones en este dispositivo.',
    );
  }
}

let permissionFlight: Promise<import('expo-notifications').NotificationPermissionsStatus> | null =
  null;
let permissionAttempted = false;
export async function requestNativePermissionOnce(
  notifications: Pick<
    typeof import('expo-notifications'),
    'getPermissionsAsync' | 'requestPermissionsAsync'
  >,
) {
  if (permissionFlight) return permissionFlight;
  permissionFlight = (async () => {
    const current = await notifications.getPermissionsAsync();
    if (current.status !== 'undetermined' || !current.canAskAgain) return current;
    let stored = false;
    try {
      stored = (await SecureStore.getItemAsync('cemydi-notification-permission-requested')) === '1';
    } catch {
      /* OS status and session guard still apply. */
    }
    if (permissionAttempted || stored) return current;
    permissionAttempted = true;
    try {
      await SecureStore.setItemAsync('cemydi-notification-permission-requested', '1');
    } catch {
      /* Avoid repeat prompts in this session. */
    }
    return notifications.requestPermissionsAsync();
  })().finally(() => {
    permissionFlight = null;
  });
  return permissionFlight;
}

export async function registerNativePush(isCurrent: () => boolean, requestPermission: boolean) {
  const notifications = await loadNativeNotifications();
  const projectId: unknown =
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('cemydi', {
      name: 'Avisos de CEMYDI',
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }
  let permission = await notifications.getPermissionsAsync();
  if (!isCurrent()) return;
  if (!permission.granted && requestPermission && permission.status === 'undetermined')
    permission = await requestNativePermissionOnce(notifications);
  if (!permission.granted) {
    if (!requestPermission) return;
    throw new UserFacingError(
      'Permite las notificaciones de CEMYDI en los ajustes de tu dispositivo.',
    );
  }
  if (typeof projectId !== 'string' || !/^[a-f0-9-]{36}$/i.test(projectId)) {
    if (!requestPermission) return;
    throw new UserFacingError(
      'Las notificaciones push todavía no están disponibles. Puedes consultar tu bandeja.',
    );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const token = await Promise.race([
    notifications.getExpoPushTokenAsync({ projectId }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new UserFacingError(
              'No pudimos activar este dispositivo. Revisa tu conexión e intenta de nuevo.',
            ),
          ),
        15000,
      );
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
  if (!isCurrent())
    throw new UserFacingError('La sesión cambió. Vuelve a abrir las notificaciones.');
  await notificationService.register(token.data);
  return token.data;
}

export function notificationIdFromData(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('notificationId' in data)) return null;
  const id = data.notificationId;
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : null;
}
