import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import {
  inboxSchema,
  notificationDetailSchema,
  notificationPromotionSchema,
  preferencesResponseSchema,
  type NotificationPreferences,
} from './notification-schemas';

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { method?: 'GET' | 'POST' | 'PATCH'; json?: object; signal?: AbortSignal } = {},
) {
  const data = await httpClient.request(path, {
    authenticated: true,
    cache: 'no-store',
    ...options,
  });
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new ApiError('La respuesta de notificaciones no es válida.', {
      kind: 'parse',
      cause: parsed.error,
    });
  return parsed.data;
}
const messageSchema = z.object({ message: z.string() });
export const notificationService = {
  inbox(page = 1, category?: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(page) });
    if (category) query.set('category', category);
    return request(`/notifications?${query}`, inboxSchema, { signal });
  },
  detail(id: string, signal?: AbortSignal) {
    return request(`/notifications/${encodeURIComponent(id)}`, notificationDetailSchema, {
      signal,
    });
  },
  promotion(id: string, signal?: AbortSignal) {
    return request(
      `/notifications/promotion/${encodeURIComponent(id)}`,
      notificationPromotionSchema,
      { signal },
    );
  },
  read(ids: string[]) {
    return request('/notifications/read', messageSchema, { method: 'PATCH', json: { ids } });
  },
  readAll() {
    return request('/notifications/read-all', messageSchema, { method: 'PATCH' });
  },
  preferences(signal?: AbortSignal) {
    return request('/notifications/preferences', preferencesResponseSchema, { signal });
  },
  savePreferences(preferences: NotificationPreferences) {
    return request('/notifications/preferences', preferencesResponseSchema, {
      method: 'PATCH',
      json: preferences,
    });
  },
  register(token: string) {
    return request('/notifications/subscriptions/register', z.object({ id: z.string() }), {
      method: 'POST',
      json: { channel: 'EXPO', endpoint: token },
    });
  },
  unregister(token: string) {
    return request('/notifications/subscriptions/unregister', messageSchema, {
      method: 'POST',
      json: { endpoint: token },
    });
  },
};
