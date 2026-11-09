import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

export const PUSH_REGISTRATION_KEY = 'cemydi-registered-push-token';
const registrationSchema = z.object({
  userId: z.number().int().positive(),
  endpoint: z
    .string()
    .max(512)
    .regex(/^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_-]+\]$/),
});
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
let storageQueue: Promise<unknown> = Promise.resolve();

function withStorage<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation);
  storageQueue = result.catch(() => undefined);
  return result;
}

export function savePushRegistration(endpoint: string, userId: number, isCurrent: () => boolean) {
  return withStorage(async () => {
    if (!isCurrent()) return;
    const registration = registrationSchema.parse({ endpoint, userId });
    await SecureStore.setItemAsync(PUSH_REGISTRATION_KEY, JSON.stringify(registration), options);
  });
}

export type PushCleanupStatus = 'cleared' | 'pending' | 'failed';

export function clearPushRegistration(
  userId: number | undefined,
  isCurrent: () => boolean,
): Promise<PushCleanupStatus> {
  return withStorage(async () => {
    try {
      if (!isCurrent()) return 'pending';
      const stored = await SecureStore.getItemAsync(PUSH_REGISTRATION_KEY, options);
      if (!stored) return 'cleared';
      if (stored.length > 1024) return 'failed';
      const parsed = registrationSchema.safeParse(JSON.parse(stored));
      if (!parsed.success) return 'failed';
      if (parsed.data.userId !== userId || !isCurrent()) return 'pending';
      await SecureStore.deleteItemAsync(PUSH_REGISTRATION_KEY, options);
      return 'cleared';
    } catch {
      return 'failed';
    }
  });
}
